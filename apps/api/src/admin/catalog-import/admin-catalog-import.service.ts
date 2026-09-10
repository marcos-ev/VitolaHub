import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CATALOG_IMPORT_COLUMNS, DUPLICATE_SIMILARITY_THRESHOLD } from './catalog-import.constants';
import { RawImportRow, UploadedImportFile, parseImportFile } from './catalog-import-file.parser';
import {
  buildFullName,
  normalizeCountryCode,
  normalizeVitola,
  parseLengthMm,
  parseOptionalInt,
  parseOptionalString,
} from './catalog-import.util';
import { CommitCatalogImportDto, CommitCatalogImportRowDto } from './dto/commit-catalog-import.dto';

export interface PreviewRow {
  rowNumber: number;
  brandName: string;
  brandStatus: 'EXISTING' | 'NEW';
  manufacturer: string | null;
  countryCode: string | null;
  line: string | null;
  name: string;
  vitola: string | null;
  vitolaRecognized: boolean;
  lengthMm: number | null;
  ringGauge: number | null;
  strength: number | null;
  wrapper: string | null;
  avgSmokeMinutes: number | null;
  imageUrl: string | null;
  action: 'CREATE' | 'UPDATE';
  matchedCigarId: string | null;
  possibleDuplicateOf: { id: string; name: string; similarity: number } | null;
  warnings: string[];
  errors: string[];
}

export interface PreviewResult {
  fileName: string;
  columnsExpected: readonly string[];
  totalRows: number;
  rows: PreviewRow[];
  summary: { toCreate: number; toUpdate: number; withWarnings: number; withErrors: number };
}

export interface CommitRowResult {
  rowIndex: number;
  action: 'CREATED' | 'UPDATED' | 'SKIPPED';
  cigarId: string | null;
  name: string;
}

export interface CommitResult {
  fileName: string;
  created: number;
  updated: number;
  skipped: number;
  results: CommitRowResult[];
}

/**
 * Importador de catálogo por CSV/XLSX (seção 5.3) — fluxo em duas etapas
 * (`preview` nunca grava nada, `commit` grava de fato). Colunas esperadas no
 * arquivo (linha de cabeçalho, nomes exatamente como em
 * `CATALOG_IMPORT_COLUMNS`):
 *
 *   marca, fabricante, pais, linha, nome, vitola, comprimento_mm,
 *   bitola_ring_gauge, forca, capa, tempo_medio_min, imagem_url
 *
 * Reimportação idempotente: a chave de correspondência é
 * `(source, brandId, line, name)`, onde `source = "import:{fileName}"`.
 * Rodar o mesmo arquivo duas vezes atualiza os registros já existentes em
 * vez de duplicá-los.
 */
@Injectable()
export class AdminCatalogImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(file: UploadedImportFile | undefined, lengthUnit: 'mm' | 'in' = 'mm'): Promise<PreviewResult> {
    if (!file) throw new BadRequestException('Envie um arquivo em CSV ou XLSX no campo "file"');

    const rawRows = parseImportFile(file);
    return this.buildPreview(file.originalname, rawRows, lengthUnit);
  }

  private async buildPreview(fileName: string, rawRows: RawImportRow[], lengthUnit: 'mm' | 'in'): Promise<PreviewResult> {
    const source = `import:${fileName}`;
    const rows: PreviewRow[] = [];

    let rowNumber = 0;
    for (const raw of rawRows) {
      rowNumber += 1;
      rows.push(await this.normalizeRow(raw, rowNumber, source, lengthUnit));
    }

    const summary = {
      toCreate: rows.filter((r) => r.action === 'CREATE').length,
      toUpdate: rows.filter((r) => r.action === 'UPDATE').length,
      withWarnings: rows.filter((r) => r.warnings.length > 0).length,
      withErrors: rows.filter((r) => r.errors.length > 0).length,
    };

    return { fileName, columnsExpected: CATALOG_IMPORT_COLUMNS, totalRows: rows.length, rows, summary };
  }

  private async normalizeRow(
    raw: RawImportRow,
    rowNumber: number,
    source: string,
    lengthUnit: 'mm' | 'in',
  ): Promise<PreviewRow> {
    const warnings: string[] = [];
    const errors: string[] = [];

    const brandNameRaw = parseOptionalString(raw['marca']);
    if (!brandNameRaw) errors.push('coluna "marca" obrigatória');

    const nameRaw = parseOptionalString(raw['nome']);
    if (!nameRaw) errors.push('coluna "nome" obrigatória');

    const manufacturer = parseOptionalString(raw['fabricante']);
    const line = parseOptionalString(raw['linha']);

    const country = normalizeCountryCode(raw['pais']);
    if (country.error) errors.push(country.error);
    else if (!country.recognized) {
      warnings.push(`país "${country.code}" fora da lista conhecida de origens de charuto — verifique`);
    }

    const vitola = normalizeVitola(raw['vitola']);
    if (vitola.value && !vitola.recognized) {
      warnings.push(`vitola "${vitola.value}" fora da lista controlada — verifique a grafia`);
    }

    const length = parseLengthMm(raw['comprimento_mm'], lengthUnit);
    if (length.error) errors.push(length.error);

    const ringGauge = parseOptionalInt(raw['bitola_ring_gauge']);
    const strength = parseOptionalInt(raw['forca']);
    const wrapper = parseOptionalString(raw['capa']);
    const avgSmokeMinutes = parseOptionalInt(raw['tempo_medio_min']);
    const imageUrl = parseOptionalString(raw['imagem_url']);

    const brandName = brandNameRaw ?? '(marca ausente)';
    const name = nameRaw ?? '(nome ausente)';

    const existingBrand = brandNameRaw
      ? await this.prisma.brand.findFirst({ where: { name: { equals: brandNameRaw, mode: 'insensitive' } } })
      : null;

    let action: 'CREATE' | 'UPDATE' = 'CREATE';
    let matchedCigarId: string | null = null;
    if (existingBrand) {
      const matched = await this.findExistingImportedCigar(source, existingBrand.id, line, name);
      if (matched) {
        action = 'UPDATE';
        matchedCigarId = matched.id;
      }
    }

    let possibleDuplicateOf: PreviewRow['possibleDuplicateOf'] = null;
    if (brandNameRaw && nameRaw && errors.length === 0) {
      const fullName = buildFullName(brandName, line, name);
      possibleDuplicateOf = await this.findPossibleDuplicate(fullName, matchedCigarId ?? undefined);
    }

    return {
      rowNumber,
      brandName,
      brandStatus: existingBrand ? 'EXISTING' : 'NEW',
      manufacturer,
      countryCode: country.code,
      line,
      name,
      vitola: vitola.value,
      vitolaRecognized: vitola.recognized,
      lengthMm: length.valueMm,
      ringGauge,
      strength,
      wrapper,
      avgSmokeMinutes,
      imageUrl,
      action,
      matchedCigarId,
      possibleDuplicateOf,
      warnings,
      errors,
    };
  }

  private async findExistingImportedCigar(source: string, brandId: string, line: string | null, name: string) {
    return this.prisma.cigar.findFirst({
      where: {
        source,
        brandId,
        name: { equals: name, mode: 'insensitive' },
        ...(line ? { line: { equals: line, mode: 'insensitive' } } : { line: null }),
      },
    });
  }

  /**
   * Dedup por similaridade (seção 5.3) via `pg_trgm`/`similarity()`, mesmo
   * padrão de `$queryRaw` usado em `catalog.service.ts`. Sinaliza sem
   * bloquear quando a maior similaridade encontrada excede
   * `DUPLICATE_SIMILARITY_THRESHOLD`.
   */
  private async findPossibleDuplicate(
    fullName: string,
    excludeCigarId?: string,
  ): Promise<{ id: string; name: string; similarity: number } | null> {
    const excludeClause = excludeCigarId ? Prisma.sql`AND c.id != ${excludeCigarId}::uuid` : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; line: string | null; brand_name: string; similarity: number }[]
    >`
      SELECT c.id, c.name, c.line, b.name AS brand_name,
        similarity(${fullName}, b.name || ' ' || coalesce(c.line || ' ', '') || c.name) AS similarity
      FROM cigars c
      JOIN brands b ON b.id = c.brand_id
      WHERE c.deleted_at IS NULL
      ${excludeClause}
      ORDER BY similarity DESC
      LIMIT 1
    `;

    const top = rows[0];
    if (!top || Number(top.similarity) <= DUPLICATE_SIMILARITY_THRESHOLD) return null;

    return {
      id: top.id,
      name: `${top.brand_name}${top.line ? ' ' + top.line : ''} ${top.name}`.trim(),
      similarity: Number(top.similarity),
    };
  }

  async commit(dto: CommitCatalogImportDto): Promise<CommitResult> {
    const source = `import:${dto.fileName}`;
    const results: CommitRowResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    let rowIndex = 0;
    for (const row of dto.rows) {
      rowIndex += 1;
      if (row.skip) {
        skipped += 1;
        results.push({ rowIndex, action: 'SKIPPED', cigarId: null, name: row.name });
        continue;
      }

      const outcome = await this.commitRow(source, row);
      if (outcome.action === 'CREATED') created += 1;
      else updated += 1;
      results.push({ rowIndex, ...outcome });
    }

    return { fileName: dto.fileName, created, updated, skipped, results };
  }

  private async commitRow(
    source: string,
    row: CommitCatalogImportRowDto,
  ): Promise<{ action: 'CREATED' | 'UPDATED'; cigarId: string; name: string }> {
    const brand = await this.resolveOrCreateBrand(row.brandName, row.manufacturer ?? null, row.countryCode);
    const line = row.line ?? null;

    const existing = await this.findExistingImportedCigar(source, brand.id, line, row.name);

    const data = {
      brandId: brand.id,
      name: row.name,
      line,
      countryCode: row.countryCode,
      vitola: row.vitola ?? null,
      lengthMm: row.lengthMm ?? null,
      ringGauge: row.ringGauge ?? null,
      strength: row.strength ?? null,
      wrapper: row.wrapper ?? null,
      avgSmokeMinutes: row.avgSmokeMinutes ?? null,
      imageUrl: row.imageUrl ?? null,
      source,
    };

    if (existing) {
      const cigar = await this.prisma.cigar.update({ where: { id: existing.id }, data });
      return { action: 'UPDATED', cigarId: cigar.id, name: cigar.name };
    }

    // Charutos importados de fonte oficial da equipe entram já `APPROVED`
    // (diferente da sugestão de usuário, que nasce `PENDING`).
    const cigar = await this.prisma.cigar.create({ data: { ...data, status: 'APPROVED' } });
    return { action: 'CREATED', cigarId: cigar.id, name: cigar.name };
  }

  private async resolveOrCreateBrand(brandName: string, manufacturer: string | null, countryCode: string) {
    const existing = await this.prisma.brand.findFirst({
      where: { name: { equals: brandName, mode: 'insensitive' } },
    });
    if (existing) return existing;

    return this.prisma.brand.create({
      data: {
        name: brandName,
        manufacturer: manufacturer ?? undefined,
        countryCode,
      },
    });
  }
}
