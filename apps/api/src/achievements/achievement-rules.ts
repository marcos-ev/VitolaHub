import { DomainEvent } from '../queue/queue.constants';

// Formato declarativo do campo `Achievement.rule` (seção 5.4). Guardado como
// JSON em banco de propósito — novos selos nascem de um INSERT, não de
// deploy. Os tipos aqui só documentam o shape para o motor (`achievements.service.ts`).

export interface CountRule {
  type: 'count';
  event: DomainEvent;
  target: number;
}

export interface DistinctCountRule {
  type: 'distinct_count';
  event: DomainEvent;
  field: 'cigar.country_code' | 'cigar.vitola';
  target: number;
}

export interface StreakWeeksRule {
  type: 'streak_weeks';
  event: DomainEvent;
  target: number;
}

export type AchievementRule = CountRule | DistinctCountRule | StreakWeeksRule;

export function parseAchievementRule(raw: unknown): AchievementRule {
  const rule = raw as AchievementRule;
  if (!rule || typeof rule !== 'object' || !('type' in rule) || !('event' in rule) || !('target' in rule)) {
    throw new Error(`Regra de conquista malformada: ${JSON.stringify(raw)}`);
  }
  return rule;
}

/** Início (segunda-feira, UTC) da semana ISO que contém `date`. */
export function startOfIsoWeekUtc(date: Date): Date {
  const truncated = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = truncated.getUTCDay(); // 0 = domingo .. 6 = sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  truncated.setUTCDate(truncated.getUTCDate() + diffToMonday);
  return truncated;
}
