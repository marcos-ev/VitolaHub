import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCatalogImportService } from './admin-catalog-import.service';
import { CommitCatalogImportDto } from './dto/commit-catalog-import.dto';

describe('AdminCatalogImportService', () => {
  let service: AdminCatalogImportService;
  let prisma: {
    brand: { findFirst: jest.Mock; create: jest.Mock };
    cigar: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      brand: { findFirst: jest.fn(), create: jest.fn() },
      cigar: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdminCatalogImportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AdminCatalogImportService);
  });

  describe('preview', () => {
    it('lança BadRequestException quando nenhum arquivo é enviado', async () => {
      await expect(service.preview(undefined)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('faz parse do CSV, normaliza os campos e sinaliza possível duplicata acima do limiar de similaridade', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'cigar-similar', name: 'Robusto', line: null, brand_name: 'Cohiba', similarity: 0.92 },
      ]);

      const csv =
        'marca,fabricante,pais,linha,nome,vitola,comprimento_mm,bitola_ring_gauge,forca,capa,tempo_medio_min,imagem_url\n' +
        'Cohiba,Habanos,CU,,Robusto,robusto,124,50,4,Maduro,45,\n';
      const file = { originalname: 'catalogo.csv', mimetype: 'text/csv', buffer: Buffer.from(csv, 'utf8') };

      const result = await service.preview(file);

      expect(result.totalRows).toBe(1);
      const row = result.rows[0];
      expect(row.brandName).toBe('Cohiba');
      expect(row.brandStatus).toBe('NEW');
      expect(row.countryCode).toBe('CU');
      expect(row.vitola).toBe('Robusto');
      expect(row.vitolaRecognized).toBe(true);
      expect(row.lengthMm).toBe(124);
      expect(row.action).toBe('CREATE');
      expect(row.possibleDuplicateOf).toEqual({ id: 'cigar-similar', name: 'Cohiba Robusto', similarity: 0.92 });
      expect(row.errors).toHaveLength(0);
    });

    it('não sinaliza duplicata quando a maior similaridade encontrada está abaixo do limiar', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'cigar-other', name: 'Toro', line: null, brand_name: 'Outra Marca', similarity: 0.4 },
      ]);

      const csv =
        'marca,fabricante,pais,linha,nome,vitola,comprimento_mm,bitola_ring_gauge,forca,capa,tempo_medio_min,imagem_url\n' +
        'Cohiba,Habanos,CU,,Robusto,robusto,124,50,4,Maduro,45,\n';
      const file = { originalname: 'catalogo.csv', mimetype: 'text/csv', buffer: Buffer.from(csv, 'utf8') };

      const result = await service.preview(file);

      expect(result.rows[0].possibleDuplicateOf).toBeNull();
    });

    it('marca erro na linha quando a coluna obrigatória "nome" está vazia', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([]);

      const csv =
        'marca,fabricante,pais,linha,nome,vitola,comprimento_mm,bitola_ring_gauge,forca,capa,tempo_medio_min,imagem_url\n' +
        'Cohiba,Habanos,CU,,,robusto,124,50,4,Maduro,45,\n';
      const file = { originalname: 'catalogo.csv', mimetype: 'text/csv', buffer: Buffer.from(csv, 'utf8') };

      const result = await service.preview(file);

      expect(result.summary.withErrors).toBe(1);
      expect(result.rows[0].errors.some((e) => e.includes('nome'))).toBe(true);
    });

    it('sinaliza action=UPDATE quando já existe um charuto importado da mesma fonte com a mesma chave', async () => {
      prisma.brand.findFirst.mockResolvedValue({ id: 'brand-1', name: 'Cohiba' });
      prisma.cigar.findFirst.mockResolvedValue({ id: 'cigar-1' });
      prisma.$queryRaw.mockResolvedValue([]);

      const csv =
        'marca,fabricante,pais,linha,nome,vitola,comprimento_mm,bitola_ring_gauge,forca,capa,tempo_medio_min,imagem_url\n' +
        'Cohiba,Habanos,CU,,Robusto,robusto,124,50,4,Maduro,45,\n';
      const file = { originalname: 'catalogo.csv', mimetype: 'text/csv', buffer: Buffer.from(csv, 'utf8') };

      const result = await service.preview(file);

      expect(result.rows[0].action).toBe('UPDATE');
      expect(result.rows[0].matchedCigarId).toBe('cigar-1');
    });
  });

  describe('commit — reimportação idempotente', () => {
    it('rodar o mesmo payload duas vezes atualiza o registro existente em vez de criar um duplicado', async () => {
      const state: { brand: { id: string; name: string } | null; cigar: Record<string, unknown> | null } = {
        brand: null,
        cigar: null,
      };

      prisma.brand.findFirst.mockImplementation(async () => state.brand);
      prisma.brand.create.mockImplementation(async ({ data }: { data: { name: string } }) => {
        state.brand = { id: 'brand-1', name: data.name };
        return state.brand;
      });
      prisma.cigar.findFirst.mockImplementation(async () => state.cigar);
      prisma.cigar.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        state.cigar = { id: 'cigar-1', ...data };
        return state.cigar;
      });
      prisma.cigar.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        state.cigar = { ...state.cigar, ...data };
        return state.cigar;
      });

      const dto: CommitCatalogImportDto = {
        fileName: 'catalogo.csv',
        rows: [
          {
            brandName: 'Cohiba',
            countryCode: 'CU',
            name: 'Robusto',
            vitola: 'Robusto',
            lengthMm: 124,
            ringGauge: 50,
          },
        ],
      };

      const firstRun = await service.commit(dto);
      expect(firstRun.created).toBe(1);
      expect(firstRun.updated).toBe(0);
      expect(prisma.cigar.create).toHaveBeenCalledTimes(1);
      expect(state.cigar?.status).toBe('APPROVED');
      expect(state.cigar?.source).toBe('import:catalogo.csv');

      const secondRun = await service.commit(dto);

      expect(secondRun.created).toBe(0);
      expect(secondRun.updated).toBe(1);
      // A contagem de "criações" nunca dobra: só houve 1 create ao longo das
      // duas execuções — a segunda passagem foi um update.
      expect(prisma.cigar.create).toHaveBeenCalledTimes(1);
      expect(prisma.cigar.update).toHaveBeenCalledTimes(1);
      expect(prisma.cigar.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cigar-1' } }),
      );
    });

    it('linhas marcadas com skip=true não geram create nem update', async () => {
      const dto: CommitCatalogImportDto = {
        fileName: 'catalogo.csv',
        rows: [{ skip: true, brandName: 'Cohiba', countryCode: 'CU', name: 'Robusto' }],
      };

      const result = await service.commit(dto);

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      expect(prisma.brand.findFirst).not.toHaveBeenCalled();
      expect(prisma.cigar.create).not.toHaveBeenCalled();
    });
  });
});
