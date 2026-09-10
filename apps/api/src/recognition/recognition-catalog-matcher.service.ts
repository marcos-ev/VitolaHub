import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RECOGNITION_MIN_SCORE_THRESHOLD, RECOGNITION_TOP_MATCHES_LIMIT } from './recognition.constants';
import { RecognitionCandidate, VitolaOption } from './interfaces/recognition.types';
import { LabelExtraction } from './recognition-model.client';

interface ScoredCigarRow {
  id: string;
  name: string;
  line: string | null;
  vitola: string | null;
  image_url: string | null;
  brand_id: string;
  brand_name: string;
  score: number;
}

export interface CatalogMatchResult {
  matches: RecognitionCandidate[];
  requiresVitolaDisambiguation: boolean;
  vitolaOptions: VitolaOption[];
}

const EMPTY_RESULT: CatalogMatchResult = { matches: [], requiresVitolaDisambiguation: false, vitolaOptions: [] };

/**
 * Casa o texto extraído da anilha contra `cigars`/`brands` via similaridade
 * de trigramas (`pg_trgm`) + `unaccent`, com peso extra para acerto de marca
 * — mesmo padrão de `$queryRaw`/`Prisma.sql` usado em
 * `CatalogService.search`. Só leitura: o modelo NUNCA escreve no catálogo.
 */
@Injectable()
export class RecognitionCatalogMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async match(extraction: LabelExtraction): Promise<CatalogMatchResult> {
    const brandGuess = extraction.brandGuess?.trim() ?? '';
    const lineOrText = extraction.lineGuess?.trim() || extraction.rawText?.trim() || '';
    const rawText = extraction.rawText?.trim() ?? '';

    if (!brandGuess && !lineOrText && !rawText) {
      return EMPTY_RESULT;
    }

    const rows = await this.prisma.$queryRaw<ScoredCigarRow[]>`
      SELECT
        c.id,
        c.name,
        c.line,
        c.vitola,
        c.image_url,
        b.id AS brand_id,
        b.name AS brand_name,
        (
          coalesce(similarity(unaccent(b.name), unaccent(${brandGuess})), 0) * 0.5
          + coalesce(similarity(unaccent(coalesce(c.line, '') || ' ' || c.name), unaccent(${lineOrText})), 0) * 0.35
          + coalesce(similarity(unaccent(c.name), unaccent(${rawText})), 0) * 0.15
        ) AS score
      FROM cigars c
      JOIN brands b ON b.id = c.brand_id
      WHERE c.deleted_at IS NULL AND c.status = 'APPROVED'
      ORDER BY score DESC
      LIMIT 30
    `;

    return this.buildResult(rows);
  }

  buildResult(rows: ScoredCigarRow[]): CatalogMatchResult {
    const aboveThreshold = rows.filter((row) => row.score >= RECOGNITION_MIN_SCORE_THRESHOLD);
    if (aboveThreshold.length === 0) return EMPTY_RESULT;

    // Deduplica por marca+linha, mantendo a vitola de maior score de cada
    // linha, para não repetir a mesma linha 3x no topo só por causa de
    // vitolas diferentes — essas viram opções de desambiguação (regra 3 da
    // spec) em vez de ocupar as 3 posições do topo.
    const bestByLine = new Map<string, ScoredCigarRow>();
    for (const row of aboveThreshold) {
      const key = `${row.brand_id}::${row.line ?? ''}`;
      const current = bestByLine.get(key);
      if (!current || row.score > current.score) bestByLine.set(key, row);
    }

    const groupedByLine = [...bestByLine.values()].sort((a, b) => b.score - a.score);
    const top = groupedByLine.slice(0, RECOGNITION_TOP_MATCHES_LIMIT);

    const matches: RecognitionCandidate[] = top.map((row) => ({
      cigarId: row.id,
      brandName: row.brand_name,
      cigarName: row.name,
      line: row.line,
      vitola: row.vitola,
      imageUrl: row.image_url,
      confidencePercent: Math.max(0, Math.min(100, Math.round(row.score * 100))),
    }));

    const best = top[0];
    const siblingVitolas = aboveThreshold.filter(
      (row) => row.brand_id === best.brand_id && (row.line ?? '') === (best.line ?? ''),
    );
    const distinctVitolas = new Set(siblingVitolas.map((row) => row.vitola ?? ''));
    const requiresVitolaDisambiguation = distinctVitolas.size > 1;
    const vitolaOptions: VitolaOption[] = requiresVitolaDisambiguation
      ? siblingVitolas
          .slice()
          .sort((a, b) => (a.vitola ?? '').localeCompare(b.vitola ?? ''))
          .map((row) => ({ cigarId: row.id, vitola: row.vitola }))
      : [];

    return { matches, requiresVitolaDisambiguation, vitolaOptions };
  }
}
