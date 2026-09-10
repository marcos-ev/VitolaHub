import { Injectable } from '@nestjs/common';

export interface ImageModerationResult {
  approved: boolean;
  reason?: string;
}

export interface ImageModerationService {
  moderate(buffer: Buffer): Promise<ImageModerationResult>;
}

export const IMAGE_MODERATION_SERVICE = 'IMAGE_MODERATION_SERVICE';

/**
 * Implementação padrão, permissiva (interface plugável — seção 2/8): sempre
 * aprova. Isso é intencional: nenhum classificador de conteúdo impróprio
 * está disponível hoje.
 *
 * TODO: plugar classificador real de conteúdo impróprio antes de produção.
 */
@Injectable()
export class PermissiveImageModerationService implements ImageModerationService {
  async moderate(_buffer: Buffer): Promise<ImageModerationResult> {
    return { approved: true };
  }
}
