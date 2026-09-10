import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { QueueName } from '../queue/queue.constants';
import { RecognitionQueueEvents } from './recognition-queue-events';
import { ScanRecognitionDto } from './dto/scan-recognition.dto';
import { ConfirmRecognitionDto } from './dto/confirm-recognition.dto';
import { RecognitionJobData, RecognitionScanResult } from './interfaces/recognition.types';
import {
  RECOGNITION_HASH_CACHE_TTL_SECONDS,
  RECOGNITION_HTTP_WAIT_TIMEOUT_MS,
  RECOGNITION_JOB_NAME,
  recognitionCacheKey,
  recognitionJobId,
} from './recognition.constants';

type ExistingMatchWithCigar = Prisma.RecognitionMatchGetPayload<{
  include: { cigar: { include: { brand: true } } };
}>;

/**
 * Orquestra o fluxo de reconhecimento por foto (seção 5.7): calcula o hash
 * SHA-256 da imagem já enviada ao storage (nunca confia em hash vindo do
 * cliente), evita chamar o modelo multimodal de novo para a mesma foto
 * (cache Redis de 30 dias + índice `imageHash` no Postgres como fallback) e,
 * quando é preciso processar de fato, enfileira o job e usa o padrão
 * request-reply do BullMQ (`job.waitUntilFinished`) com um timeout do lado
 * HTTP — se o timeout disparar primeiro, responde com o fallback de busca
 * manual e deixa o job seguir em segundo plano só para popular o cache para
 * a próxima vez.
 */
@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly cache: CacheService,
    private readonly queueEvents: RecognitionQueueEvents,
    @InjectQueue(QueueName.RECOGNITION)
    private readonly queue: Queue<RecognitionJobData, RecognitionScanResult>,
  ) {}

  async scan(userId: string, dto: ScanRecognitionDto): Promise<RecognitionScanResult> {
    const imageBuffer = await this.downloadObject(dto.objectKey);
    const imageHash = createHash('sha256').update(imageBuffer).digest('hex');

    const cacheKey = recognitionCacheKey(imageHash);
    const cached = await this.cache.get<RecognitionScanResult>(cacheKey);
    if (cached) return cached;

    const existing = await this.prisma.recognitionMatch.findFirst({
      where: { imageHash },
      orderBy: { createdAt: 'desc' },
      include: { cigar: { include: { brand: true } } },
    });
    if (existing) {
      const rebuilt = this.rebuildResultFromExistingMatch(existing, imageHash);
      await this.cache.set(cacheKey, rebuilt, RECOGNITION_HASH_CACHE_TTL_SECONDS);
      return rebuilt;
    }

    const jobData: RecognitionJobData = { userId, objectKey: dto.objectKey, imageHash };
    const job = await this.queue.add(RECOGNITION_JOB_NAME, jobData, { jobId: recognitionJobId(imageHash) });

    try {
      return await job.waitUntilFinished(this.queueEvents, RECOGNITION_HTTP_WAIT_TIMEOUT_MS);
    } catch {
      this.logger.warn(
        `Timeout do lado HTTP esperando o job de reconhecimento (${imageHash}) — respondendo com fallback de busca manual; o job segue em segundo plano`,
      );
      return {
        matchId: null,
        imageHash,
        cropUrl: null,
        matches: [],
        requiresVitolaDisambiguation: false,
        vitolaOptions: [],
        fallbackToManualSearch: true,
      };
    }
  }

  /**
   * Usuário confirma explicitamente qual candidato está correto (ou `null`
   * para "nenhum bateu"). Esta é a ÚNICA operação que grava `cigarId` +
   * `confirmed: true` — o processor nunca faz isso sozinho.
   */
  async confirm(userId: string, matchId: string, dto: ConfirmRecognitionDto) {
    const match = await this.prisma.recognitionMatch.findFirst({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Reconhecimento não encontrado');
    if (match.userId !== userId) throw new ForbiddenException('Este reconhecimento não pertence a você');

    if (dto.cigarId) {
      const cigar = await this.prisma.cigar.findFirst({ where: { id: dto.cigarId, deletedAt: null } });
      if (!cigar) throw new NotFoundException('Charuto não encontrado');
    }

    const updated = await this.prisma.recognitionMatch.update({
      where: { id: matchId },
      data: { cigarId: dto.cigarId ?? null, confirmed: true },
    });

    return { matchId: updated.id, cigarId: updated.cigarId, confirmed: updated.confirmed };
  }

  private rebuildResultFromExistingMatch(
    existing: ExistingMatchWithCigar,
    imageHash: string,
  ): RecognitionScanResult {
    // O cache do Postgres sobrevive à expiração do Redis, mas só guarda o
    // candidato vencedor por scan (ver RecognitionProcessor.persistMatch) —
    // por isso o resultado reconstruído aqui traz no máximo 1 candidato,
    // mesmo que o scan original tenha avaliado até 3. Ainda assim cumpre a
    // regra de nunca cobrar duas vezes pela mesma foto.
    const matches = existing.cigar
      ? [
          {
            cigarId: existing.cigar.id,
            brandName: existing.cigar.brand.name,
            cigarName: existing.cigar.name,
            line: existing.cigar.line,
            vitola: existing.cigar.vitola,
            imageUrl: existing.cigar.imageUrl,
            confidencePercent: existing.confidence ? Math.round(Number(existing.confidence) * 100) : 0,
          },
        ]
      : [];

    return {
      matchId: existing.id,
      imageHash,
      cropUrl: existing.cropUrl,
      matches,
      requiresVitolaDisambiguation: false,
      vitolaOptions: [],
      fallbackToManualSearch: matches.length === 0,
    };
  }

  /**
   * `objectKey` vem do cliente (após o upload via URL pré-assinada) — nunca
   * confie que o objeto exista de fato no storage. Um erro do S3/MinIO aqui
   * (chave inválida, upload incompleto, bucket errado) deve virar um 400
   * tratável pelo app, nunca um 500 genérico.
   */
  private async downloadObject(key: string): Promise<Buffer> {
    try {
      const response = await this.mediaService
        .getClient()
        .send(new GetObjectCommand({ Bucket: this.mediaService.getBucket(), Key: key }));
      const bytes = await response.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      this.logger.warn(`Falha ao baixar objeto '${key}' do storage para reconhecimento: ${(error as Error).message}`);
      throw new BadRequestException('Não foi possível acessar a imagem enviada. Tente enviar a foto novamente.');
    }
  }
}
