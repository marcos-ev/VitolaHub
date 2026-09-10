import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RecognitionCatalogMatcherService } from './recognition-catalog-matcher.service';

describe('RecognitionCatalogMatcherService', () => {
  let service: RecognitionCatalogMatcherService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [RecognitionCatalogMatcherService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RecognitionCatalogMatcherService);
  });

  describe('match', () => {
    it('não consulta o catálogo quando o modelo não extraiu nenhum texto útil', async () => {
      const result = await service.match({ brandGuess: null, lineGuess: null, rawText: null });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(result).toEqual({ matches: [], requiresVitolaDisambiguation: false, vitolaOptions: [] });
    });

    it('consulta o catálogo via $queryRaw quando há texto extraído', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'cigar-1',
          name: 'Cohiba Robusto',
          line: 'Línea Clásica',
          vitola: 'Robusto',
          image_url: null,
          brand_id: 'brand-1',
          brand_name: 'Cohiba',
          score: 0.9,
        },
      ]);

      const result = await service.match({ brandGuess: 'Cohiba', lineGuess: null, rawText: 'COHIBA ROBUSTO' });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]).toMatchObject({ cigarId: 'cigar-1', brandName: 'Cohiba', confidencePercent: 90 });
    });
  });

  describe('buildResult — casamento de texto contra o catálogo', () => {
    it('descarta candidatos abaixo do score mínimo', () => {
      const result = service.buildResult([
        {
          id: 'cigar-1',
          name: 'Charuto qualquer',
          line: null,
          vitola: null,
          image_url: null,
          brand_id: 'brand-1',
          brand_name: 'Marca qualquer',
          score: 0.05,
        },
      ]);

      expect(result).toEqual({ matches: [], requiresVitolaDisambiguation: false, vitolaOptions: [] });
    });

    it('devolve no máximo 3 candidatos, ordenados por score decrescente', () => {
      const rows = [
        { score: 0.5, brand_id: 'b1', line: 'L1' },
        { score: 0.9, brand_id: 'b2', line: 'L2' },
        { score: 0.7, brand_id: 'b3', line: 'L3' },
        { score: 0.6, brand_id: 'b4', line: 'L4' },
      ].map((r, i) => ({
        id: `cigar-${i}`,
        name: `Charuto ${i}`,
        line: r.line,
        vitola: 'Robusto',
        image_url: null,
        brand_id: r.brand_id,
        brand_name: `Marca ${i}`,
        score: r.score,
      }));

      const result = service.buildResult(rows);

      expect(result.matches).toHaveLength(3);
      expect(result.matches.map((m) => m.confidencePercent)).toEqual([90, 70, 60]);
    });

    it('detecta múltiplas vitolas da mesma linha e sinaliza requiresVitolaDisambiguation com as opções', () => {
      const rows = [
        {
          id: 'cigar-robusto',
          name: 'Cohiba Robusto',
          line: 'Línea Clásica',
          vitola: 'Robusto',
          image_url: null,
          brand_id: 'brand-1',
          brand_name: 'Cohiba',
          score: 0.9,
        },
        {
          id: 'cigar-toro',
          name: 'Cohiba Toro',
          line: 'Línea Clásica',
          vitola: 'Toro',
          image_url: null,
          brand_id: 'brand-1',
          brand_name: 'Cohiba',
          score: 0.85,
        },
        {
          id: 'cigar-outra-marca',
          name: 'Montecristo No. 2',
          line: null,
          vitola: 'Torpedo',
          image_url: null,
          brand_id: 'brand-2',
          brand_name: 'Montecristo',
          score: 0.3,
        },
      ];

      const result = service.buildResult(rows);

      // O grupo (marca+linha) deduplica para 1 posição no topo — a
      // vitola de maior score representa a linha nas 3 posições.
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0]).toMatchObject({ cigarId: 'cigar-robusto', vitola: 'Robusto' });

      expect(result.requiresVitolaDisambiguation).toBe(true);
      expect(result.vitolaOptions).toEqual([
        { cigarId: 'cigar-robusto', vitola: 'Robusto' },
        { cigarId: 'cigar-toro', vitola: 'Toro' },
      ]);
    });

    it('não sinaliza desambiguação quando a linha do melhor candidato só tem uma vitola no catálogo', () => {
      const rows = [
        {
          id: 'cigar-1',
          name: 'Montecristo No. 2',
          line: null,
          vitola: 'Torpedo',
          image_url: null,
          brand_id: 'brand-1',
          brand_name: 'Montecristo',
          score: 0.8,
        },
      ];

      const result = service.buildResult(rows);

      expect(result.requiresVitolaDisambiguation).toBe(false);
      expect(result.vitolaOptions).toEqual([]);
    });
  });
});
