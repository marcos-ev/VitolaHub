import { NotificationItem, NotificationType } from '../api/types';

const ICONS: Record<NotificationType, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  FOLLOW_REQUEST: 'person-add-outline',
  FOLLOW_ACCEPTED: 'people-outline',
  LIKE: 'heart',
  COMMENT: 'chatbubble-outline',
  ACHIEVEMENT_UNLOCKED: 'trophy-outline',
  TRIAL_ENDING: 'time-outline',
  TRIAL_EXPIRED: 'alert-circle-outline',
  SHOP_MESSAGE: 'storefront-outline',
  INVITE_ACCEPTED: 'gift-outline',
};

export function getNotificationIcon(type: NotificationType) {
  return ICONS[type] ?? 'notifications-outline';
}

export function getNotificationMessage(item: NotificationItem): string {
  const actorName = item.actor?.displayName ?? 'Alguém';
  switch (item.type) {
    case 'FOLLOW_REQUEST':
      return `${actorName} quer seguir você`;
    case 'FOLLOW_ACCEPTED':
      return `${actorName} aceitou sua solicitação para seguir`;
    case 'LIKE':
      return `${actorName} curtiu sua publicação`;
    case 'COMMENT':
      return `${actorName} comentou na sua publicação`;
    case 'ACHIEVEMENT_UNLOCKED':
      return 'Você desbloqueou uma nova conquista!';
    case 'TRIAL_ENDING':
      return 'Seu período de teste está acabando';
    case 'TRIAL_EXPIRED':
      return 'Seu período de teste expirou';
    case 'SHOP_MESSAGE':
      return `${actorName} enviou uma mensagem`;
    case 'INVITE_ACCEPTED':
      return `${actorName} aceitou seu convite`;
    default:
      return 'Nova notificação';
  }
}
