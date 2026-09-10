import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { RecognitionSource } from '@prisma/client';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { MediaService } from '../../media/media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { QueueName } from '../../queue/queue.constants';
import { RecognitionCatalogMatcherService } from '../recognition-catalog-matcher.service';
import { RecognitionModelClient } from '../recognition-model.client';
import { RecognitionJobData, RecognitionScanResult } from '../interfaces/recognition.types';
import {
  RECOGNITION_CENTER_CROP_RATIO,
  RECOGNITION_HASH_CACHE_TTL_SECONDS,
  RECOGNITION_PROCESSOR_TIMEOUT_MS,
  recognitionCacheKey,
} from '../recognition.constants';

function fallbackResult(imageHash: string): RecognitionScanResult {
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

/**
 * Worker da fila `recognition` (seção 5.7): baixa a imagem já enviada ao
 * storage, recorta uma região central + normaliza contraste/nitidez com
 * `sharp`, extrai o texto da anilha via modelo multimodal e casa contra o
 * catálogo. NUNCA lança — qualquer erro ou timeout interno resolve o job com
 * o fallback de busca manual, para o request-reply do lado HTTP nunca ficar
 * esperando indefinidamente ("toda chamada roda em fila, com timeout e
 * fallback imediato para busca manual").
 *
 * Simplificação de MVP documentada: em vez de correção de perspectiva, o
 * mobile já orienta o usuário a centralizar a anilha no guia de
 * enquadramento da câmera — um recorte central de 60% da área + `normalize()`
 * (contraste) e `sharpen()` (nitidez) via `sharp` já é suficiente para o
 * texto ficar legível o bastante para o modelo multimodal nesta fase.
 */
@Processor(QueueName.RECOGNITION)
export class RecognitionProcessor extends WorkerHost {
  private readonly logger = new Logger(RecognitionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly cache: CacheService,
    private readonly modelClient: RecognitionModelClient,
    private readonly matcher: RecognitionCatalogMatcherService,
  ) {
    super();
  }

  async process(job: Job<RecognitionJobData>): Promise<RecognitionScanResult> {
    const { userId, objectKey, imageHash } = job.data;

    let timeoutHandle!: NodeJS.Timeout;
    const timeoutPromise = new Promise<RecognitionScanResult>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(fallbackResult(imageHash)), RECOGNITION_PROCESSOR_TIMEOUT_MS);
    });

    const workPromise = this.runPipeline(userId, objectKey, imageHash).catch((error: Error) => {
      this.logger.warn(`Falha no pipeline de reconhecimento (${imageHash}): ${error.message}`);
      return fallbackResult(imageHash);
    });

    // Mesmo se o timeout interno vencer a corrida contra o pipeline real, o
    // trabalho continua rodando em segundo plano só para popular o cache por
    // hash (Redis) a tempo do próximo scan da mesma foto não pagar de novo.
    void workPromise.then((result) =>
      this.cache.set(recognitionCacheKey(imageHash), result, RECOGNITION_HASH_CACHE_TTL_SECONDS),
    );

    try {
      return await Promise.race([workPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async runPipeline(userId: string, objectKey: string, imageHash: string): Promise<RecognitionScanResult> {
    const original = await this.downloadObject(objectKey);
    const cropBuffer = await this.buildCrop(original);
    const cropKey = `recognition-crops/${imageHash}.jpg`;
    await this.uploadObject(cropKey, cropBuffer);
    const cropUrl = this.mediaService.buildPublicUrl(cropKey);

    const extraction = await this.modelClient.extractLabelText(cropBuffer.toString('base64'), 'image/jpeg');

    if (!extraction) {
      const matchId = await this.persistMatch(userId, imageHash, cropUrl, null, null);
      return {
        matchId,
        imageHash,
        cropUrl,
        matches: [],
        requiresVitolaDisambiguation: false,
        vitolaOptions: [],
        fallbackToManualSearch: true,
      };
    }

    const { matches, requiresVitolaDisambiguation, vitolaOptions } = await this.matcher.match(extraction);
    const best = matches[0] ?? null;
    const matchId = await this.persistMatch(
      userId,
      imageHash,
      cropUrl,
      best?.cigarId ?? null,
      best?.confidencePercent ?? null,
    );

    return {
      matchId,
      imageHash,
      cropUrl,
      matches,
      requiresVitolaDisambiguation,
      vitolaOptions,
      fallbackToManualSearch: matches.length === 0,
    };
  }

  private async persistMatch(
    userId: string,
    imageHash: string,
    cropUrl: string,
    cigarId: string | null,
    confidencePercent: number | null,
  ): Promise<string> {
    const created = await this.prisma.recognitionMatch.create({
      data: {
        userId,
        cigarId,
        cropUrl,
        confidence: confidencePercent !== null ? confidencePercent / 100 : null,
        source: RecognitionSource.MODEL,
        confirmed: false,
        imageHash,
        // `embedding` (pgvector) fica de fora de propósito: é o gancho para o
        // futuro reconhecimento por similaridade visual direta (aprendizado
        // acumulado de longo prazo), fora do escopo deste MVP. Campo
        // `Unsupported` no Prisma — nem aparece no client de escrita, só via
        // `$queryRaw`/`$executeRaw` quando essa fase for implementada.
      },
    });
    return created.id;
  }

  private async buildCrop(original: Buffer): Promise<Buffer> {
    const metadata = await sharp(original).rotate().metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
      return sharp(original).rotate().normalize().sharpen().jpeg({ quality: 90 }).toBuffer();
    }

    const cropWidth = Math.round(width * RECOGNITION_CENTER_CROP_RATIO);
    const cropHeight = Math.round(height * RECOGNITION_CENTER_CROP_RATIO);
    const left = Math.round((width - cropWidth) / 2);
    const top = Math.round((height - cropHeight) / 2);

    return sharp(original)
      .rotate()
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .normalize()
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  private async downloadObject(key: string): Promise<Buffer> {
    const response = await this.mediaService
      .getClient()
      .send(new GetObjectCommand({ Bucket: this.mediaService.getBucket(), Key: key }));
    const bytes = await response.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  private async uploadObject(key: string, body: Buffer): Promise<void> {
    await this.mediaService.getClient().send(
      new PutObjectCommand({
        Bucket: this.mediaService.getBucket(),
        Key: key,
        Body: body,
        ContentType: 'image/jpeg',
      }),
    );
  }
}
