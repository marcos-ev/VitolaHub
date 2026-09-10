import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
import { CacheService } from '../../redis/cache.service';
import { RecognitionCatalogMatcherService } from '../recognition-catalog-matcher.service';
import { RecognitionModelClient } from '../recognition-model.client';
import { RecognitionProcessor } from './recognition.processor';
import { RECOGNITION_PROCESSOR_TIMEOUT_MS } from '../recognition.constants';
import { RecognitionJobData } from '../interfaces/recognition.types';

jest.mock('sharp', () => {
  const chain = {
    rotate: jest.fn().mockReturnThis(),
    metadata: jest.fn().mockResolvedValue({ width: 1000, height: 1000 }),
    extract: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('cropped-bytes')),
  };
  return jest.fn(() => chain);
});

function buildJob(data: RecognitionJobData): Job<RecognitionJobData> {
  return { data } as unknown as Job<RecognitionJobData>;
}

describe('RecognitionProcessor', () => {
  let processor: RecognitionProcessor;
  let prisma: { recognitionMatch: { create: jest.Mock } };
  let media: { getClient: jest.Mock; getBucket: jest.Mock; buildPublicUrl: jest.Mock };
  let cache: { set: jest.Mock };
  let modelClient: { extractLabelText: jest.Mock };
  let matcher: { match: jest.Mock };
  let sendMock: jest.Mock;

  beforeEach(async () => {
    sendMock = jest.fn().mockResolvedValue({
      Body: { transformToByteArray: () => Promise.resolve(Buffer.from('original-bytes')) },
    });

    media = {
      getClient: jest.fn().mockReturnValue({ send: sendMock }),
      getBucket: jest.fn().mockReturnValue('bucket'),
      buildPublicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
    };

    prisma = { recognitionMatch: { create: jest.fn().mockResolvedValue({ id: 'match-1' }) } };
    cache = { set: jest.fn() };
    modelClient = { extractLabelText: jest.fn() };
    matcher = { match: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecognitionProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaService, useValue: media },
        { provide: CacheService, useValue: cache },
        { provide: RecognitionModelClient, useValue: modelClient },
        { provide: RecognitionCatalogMatcherService, useValue: matcher },
      ],
    }).compile();

    processor = moduleRef.get(RecognitionProcessor);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolve com fallback de busca manual quando não há chave da Anthropic configurada (modelo devolve null), sem quebrar', async () => {
    modelClient.extractLabelText.mockResolvedValue(null);

    const result = await processor.process(buildJob({ userId: 'user-1', objectKey: 'k.jpg', imageHash: 'hash-1' }));

    expect(result.fallbackToManualSearch).toBe(true);
    expect(result.matches).toEqual([]);
    expect(matcher.match).not.toHaveBeenCalled();
    // Mesmo sem extração de texto, o recorte foi gerado e persistido.
    expect(prisma.recognitionMatch.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cigarId: null, imageHash: 'hash-1' }) }),
    );
  });

  it('persiste o RecognitionMatch e devolve os candidatos quando o modelo e o casamento funcionam', async () => {
    modelClient.extractLabelText.mockResolvedValue({ brandGuess: 'Cohiba', lineGuess: null, rawText: 'COHIBA' });
    matcher.match.mockResolvedValue({
      matches: [
        {
          cigarId: 'cigar-1',
          brandName: 'Cohiba',
          cigarName: 'Robusto',
          line: null,
          vitola: 'Robusto',
          imageUrl: null,
          confidencePercent: 88,
        },
      ],
      requiresVitolaDisambiguation: false,
      vitolaOptions: [],
    });

    const result = await processor.process(buildJob({ userId: 'user-1', objectKey: 'k.jpg', imageHash: 'hash-2' }));

    expect(result.fallbackToManualSearch).toBe(false);
    expect(result.matches).toHaveLength(1);
    expect(result.matchId).toBe('match-1');
    expect(result.cropUrl).toBe('https://cdn.test/recognition-crops/hash-2.jpg');
    expect(prisma.recognitionMatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cigarId: 'cigar-1', confidence: 0.88, imageHash: 'hash-2' }),
      }),
    );
  });

  it('nunca lança exceção mesmo se o download do storage falhar — resolve com fallback', async () => {
    sendMock.mockRejectedValue(new Error('S3 indisponível'));

    const result = await processor.process(buildJob({ userId: 'user-1', objectKey: 'k.jpg', imageHash: 'hash-3' }));

    expect(result).toEqual({
      matchId: null,
      imageHash: 'hash-3',
      cropUrl: null,
      matches: [],
      requiresVitolaDisambiguation: false,
      vitolaOptions: [],
      fallbackToManualSearch: true,
    });
    expect(prisma.recognitionMatch.create).not.toHaveBeenCalled();
  });

  it('resolve com fallback via timeout interno quando o pipeline demora mais que o limite configurado, sem travar o worker', async () => {
    jest.useFakeTimers();
    sendMock.mockReturnValue(new Promise(() => undefined)); // nunca resolve dentro do teste

    const resultPromise = processor.process(
      buildJob({ userId: 'user-1', objectKey: 'k.jpg', imageHash: 'hash-4' }),
    );

    await jest.advanceTimersByTimeAsync(RECOGNITION_PROCESSOR_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.fallbackToManualSearch).toBe(true);
    expect(result.matchId).toBeNull();
  });
});
