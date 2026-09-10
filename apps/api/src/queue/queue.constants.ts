// Nomes de fila centralizados (seção "Fundação"): counters, achievements,
// media, notifications, recognition, emails, chat.
export enum QueueName {
  COUNTERS = 'counters',
  ACHIEVEMENTS = 'achievements',
  MEDIA = 'media',
  NOTIFICATIONS = 'notifications',
  RECOGNITION = 'recognition',
  EMAILS = 'emails',
  // Fase 3a (charutarias/chat): lembrete de 2h sem resposta da loja,
  // agendado via `delay` a partir de `ChatService` e consumido por
  // `ChatReminderProcessor` (apps/api/src/chat/processors).
  CHAT = 'chat',
}

// Eventos de domínio publicados na fila `achievements` (seção 5.4). O worker
// avalia regras declarativas em banco contra esses eventos.
export enum DomainEvent {
  REVIEW_CREATED = 'REVIEW_CREATED',
  FOLLOW_ACCEPTED = 'FOLLOW_ACCEPTED',
  HUMIDOR_ITEM_ADDED = 'HUMIDOR_ITEM_ADDED',
  CIGAR_SUGGESTION_APPROVED = 'CIGAR_SUGGESTION_APPROVED',
}

export interface DomainEventPayload {
  [DomainEvent.REVIEW_CREATED]: {
    userId: string;
    reviewId: string;
    cigarId: string;
    cigarCountryCode: string;
    cigarVitola: string | null;
  };
  [DomainEvent.FOLLOW_ACCEPTED]: {
    userId: string;
    otherUserId: string;
    becameFriends: boolean;
  };
  [DomainEvent.HUMIDOR_ITEM_ADDED]: {
    userId: string;
    humidorItemId: string;
    cigarId: string;
  };
  [DomainEvent.CIGAR_SUGGESTION_APPROVED]: {
    userId: string;
    cigarId: string;
  };
}

// Jobs da fila `counters` — mantêm campos desnormalizados sem AVG()/COUNT()
// em tempo de leitura (seção 4).
export enum CounterJob {
  RECOMPUTE_CIGAR_RATING = 'RECOMPUTE_CIGAR_RATING',
  RECOMPUTE_POST_LIKE_COUNT = 'RECOMPUTE_POST_LIKE_COUNT',
  RECOMPUTE_POST_COMMENT_COUNT = 'RECOMPUTE_POST_COMMENT_COUNT',
  RECOMPUTE_FRIEND_COUNT = 'RECOMPUTE_FRIEND_COUNT',
  RECOMPUTE_FOLLOW_COUNTS = 'RECOMPUTE_FOLLOW_COUNTS',
}
