import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CacheService } from '../redis/cache.service';
import { QueueName } from '../queue/queue.constants';
import { RecognitionQueueEvents } from './recognition-queue-events';
import { RecognitionService } from './recognition.service';
import { RecognitionScanResult } from './interfaces/recognition.types';

const FAKE_IMAGE_BYTES = Buffer.from('fake-image-bytes');
const IMAGE_HASH = createHash('sha256').update(FAKE_IMAGE_BYTES).digest('hex');

describe('RecognitionService', () => {
  let service: RecognitionService;
  let prisma: {
    recognitionMatch: { findFirst: jest.Mock; update: jest.Mock };
    cigar: { findFirst: jest.Mock };
  };
  let media: { getClient: jest.Mock; getBucket: jest.Mock; buildPublicUrl: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };
  let queue: { add: jest.Mock };
  let job: { waitUntilFinished: jest.Mock };

  beforeEach(async () => {
    job = { waitUntilFinished: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue(job) };

    prisma = {
      recognitionMatch: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      cigar: { findFirst: jest.fn() },
    };

    media = {
      getClient: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue({
          Body: { transformToByteArray: () => Promise.resolve(FAKE_IMAGE_BYTES) },
        }),
      }),
      getBucket: jest.fn().mockReturnValue('bucket'),
      buildPublicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
    };

    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecognitionService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: CacheService, useValue: cache },
        { provide: RecognitionQueueEvents, useValue: {} },
        { provide: getQueueToken(QueueName.RECOGNITION), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(RecognitionService);
  });

  describe('scan — cache por hash', () => {
    it('devolve o resultado do cache Redis sem consultar o banco nem enfileirar (não chama o modelo de novo)', async () => {
      const cached: RecognitionScanResult = {
        matchId: 'match-1',
        imageHash: IMAGE_HASH,
        cropUrl: 'https://cdn.test/crop.jpg',
        matches: [],
        requiresVitolaDisambiguation: false,
        vitolaOptions: [],
        fallbackToManualSearch: false,
      };
      cache.get.mockResolvedValue(cached);

      const result = await service.scan('user-1', { objectKey: 'recognition/foto.jpg' });

      expect(result).toEqual(cached);
      expect(prisma.recognitionMatch.findFirst).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('reconstrói o resultado a partir de um RecognitionMatch existente no Postgres quando o cache expirou, sem enfileirar', async () => {
      prisma.recognitionMatch.findFirst.mockResolvedValue({
        id: 'match-2',
        cropUrl: 'https://cdn.test/crop-2.jpg',
        confidence: { toString: () => '0.8734' } as unknown as number,
        cigarId: 'cigar-1',
        cigar: {
          id: 'cigar-1',
          name: 'Cohiba Robusto',
          line: 'Línea Clásica',
          vitola: 'Robusto',
          imageUrl: 'https://cdn.test/cigar.jpg',
          brand: { name: 'Cohiba' },
        },
      });

      const result = await service.scan('user-1', { objectKey: 'recognition/foto.jpg' });

      expect(queue.add).not.toHaveBeenCalled();
      expect(result.matchId).toBe('match-2');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]).toMatchObject({ cigarId: 'cigar-1', brandName: 'Cohiba' });
      expect(result.fallbackToManualSearch).toBe(false);
      expect(cache.set).toHaveBeenCalled();
    });
  });

  describe('scan — objeto inexistente no storage', () => {
    it('converte falha do S3/MinIO (ex.: objectKey inválido) em BadRequestException em vez de deixar o erro subir como 500', async () => {
      media.getClient.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('NoSuchKey: The specified key does not exist.')),
      });

      await expect(service.scan('user-1', { objectKey: 'nao-existe.jpg' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('scan — fila e timeout', () => {
    it('enfileira o job com jobId determinístico pelo hash e devolve o resultado quando o worker responde a tempo', async () => {
      const workerResult: RecognitionScanResult = {
        matchId: 'match-3',
        imageHash: IMAGE_HASH,
        cropUrl: 'https://cdn.test/crop-3.jpg',
        matches: [
          {
            cigarId: 'cigar-9',
            brandName: 'Montecristo',
            cigarName: 'No. 2',
            line: null,
            vitola: 'Torpedo',
            imageUrl: null,
            confidencePercent: 82,
          },
        ],
        requiresVitolaDisambiguation: false,
        vitolaOptions: [],
        fallbackToManualSearch: false,
      };
      job.waitUntilFinished.mockResolvedValue(workerResult);

      const result = await service.scan('user-1', { objectKey: 'recognition/foto.jpg' });

      expect(queue.add).toHaveBeenCalledWith(
        'scan',
        expect.objectContaining({ userId: 'user-1', objectKey: 'recognition/foto.jpg', imageHash: IMAGE_HASH }),
        expect.objectContaining({ jobId: `recognition-${IMAGE_HASH}` }),
      );
      expect(result).toEqual(workerResult);
    });

    it('devolve o fallback de busca manual sem quebrar a requisição quando o job não termina dentro do timeout HTTP', async () => {
      job.waitUntilFinished.mockRejectedValue(new Error('job did not complete in time'));

      const result = await service.scan('user-1', { objectKey: 'recognition/foto.jpg' });

      expect(result).toEqual({
        matchId: null,
        imageHash: IMAGE_HASH,
        cropUrl: null,
        matches: [],
        requiresVitolaDisambiguation: false,
        vitolaOptions: [],
        fallbackToManualSearch: true,
      });
    });
  });

  describe('confirm', () => {
    it('nunca escreve cigarId/confirmed automaticamente durante o scan — só o endpoint de confirm grava', async () => {
      job.waitUntilFinished.mockResolvedValue({
        matchId: 'match-4',
        imageHash: IMAGE_HASH,
        cropUrl: null,
        matches: [],
        requiresVitolaDisambiguation: false,
        vitolaOptions: [],
        fallbackToManualSearch: false,
      });

      await service.scan('user-1', { objectKey: 'recognition/foto.jpg' });

      expect(prisma.recognitionMatch.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o reconhecimento não existe', async () => {
      prisma.recognitionMatch.findFirst.mockResolvedValue(null);

      await expect(service.confirm('user-1', 'match-x', { cigarId: null })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.recognitionMatch.update).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException quando o reconhecimento pertence a outro usuário', async () => {
      prisma.recognitionMatch.findFirst.mockResolvedValue({ id: 'match-1', userId: 'other-user' });

      await expect(service.confirm('user-1', 'match-1', { cigarId: null })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.recognitionMatch.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o cigarId confirmado não existe no catálogo', async () => {
      prisma.recognitionMatch.findFirst.mockResolvedValue({ id: 'match-1', userId: 'user-1' });
      prisma.cigar.findFirst.mockResolvedValue(null);

      await expect(
        service.confirm('user-1', 'match-1', { cigarId: '11111111-1111-1111-1111-111111111111' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.recognitionMatch.update).not.toHaveBeenCalled();
    });

    it('grava cigarId e confirmed=true quando o candidato existe no catálogo', async () => {
      prisma.recognitionMatch.findFirst.mockResolvedValue({ id: 'match-1', userId: 'user-1' });
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1', deletedAt: null });
      prisma.recognitionMatch.update.mockResolvedValue({ id: 'match-1', cigarId: 'cigar-1', confirmed: true });

      const result = await service.confirm('user-1', 'match-1', { cigarId: 'cigar-1' });

      expect(prisma.recognitionMatch.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { cigarId: 'cigar-1', confirmed: true },
      });
      expect(result).toEqual({ matchId: 'match-1', cigarId: 'cigar-1', confirmed: true });
    });

    it('grava cigarId null quando o usuário indica que nenhum candidato bateu (busca manual)', async () => {
      prisma.recognitionMatch.findFirst.mockResolvedValue({ id: 'match-1', userId: 'user-1' });
      prisma.recognitionMatch.update.mockResolvedValue({ id: 'match-1', cigarId: null, confirmed: true });

      const result = await service.confirm('user-1', 'match-1', { cigarId: null });

      expect(prisma.recognitionMatch.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { cigarId: null, confirmed: true },
      });
      expect(result.cigarId).toBeNull();
      expect(prisma.cigar.findFirst).not.toHaveBeenCalled();
    });
  });
});
