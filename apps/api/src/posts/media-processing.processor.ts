import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueName } from '../queue/queue.constants';
import { IMAGE_MODERATION_SERVICE, ImageModerationService } from './image-moderation.service';

export interface MediaJob {
  postMediaId: string;
  objectKey: string;
}

/**
 * Processamento assíncrono de mídia de post (seção 2/8). O post e o
 * `PostMedia` já foram criados com a URL original (não bloqueia o usuário);
 * este worker: baixa o original do S3/MinIO, roda a "moderação" (interface
 * plugável, hoje permissiva), gera 3 tamanhos (thumb 320px, feed 1080px,
 * original) convertidos para WebP e sobe de volta, atualizando a linha.
 *
 * EXIF: `sharp` remove metadados por padrão (não chamamos `.withMetadata()`,
 * que é o único jeito de preservá-los) — `.rotate()` sem argumentos aplica a
 * orientação EXIF antes de descartá-la, evitando fotos giradas.
 */
@Processor(QueueName.MEDIA)
export class MediaProcessingProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    @Inject(IMAGE_MODERATION_SERVICE) private readonly moderation: ImageModerationService,
  ) {
    super();
  }

  async process(job: Job<MediaJob>): Promise<void> {
    const { postMediaId, objectKey } = job.data;

    const original = await this.downloadObject(objectKey);

    const moderationResult = await this.moderation.moderate(original);
    if (!moderationResult.approved) {
      // TODO: decidir a política (remover mídia/post, notificar autor) quando
      // um classificador real de conteúdo impróprio estiver plugado.
      return;
    }

    const [thumbBuffer, feedBuffer, originalWebpBuffer, meta] = await Promise.all([
      sharp(original).rotate().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(),
      sharp(original).rotate().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      sharp(original).rotate().webp({ quality: 90 }).toBuffer(),
      sharp(original).rotate().metadata(),
    ]);

    const baseKey = objectKey.replace(/\.[^./]+$/, '');
    const thumbKey = `${baseKey}-thumb.webp`;
    const feedKey = `${baseKey}-feed.webp`;
    const originalKey = `${baseKey}-original.webp`;

    await Promise.all([
      this.uploadObject(thumbKey, thumbBuffer),
      this.uploadObject(feedKey, feedBuffer),
      this.uploadObject(originalKey, originalWebpBuffer),
    ]);

    await this.prisma.postMedia.update({
      where: { id: postMediaId },
      data: {
        url: this.mediaService.buildPublicUrl(originalKey),
        thumbUrl: this.mediaService.buildPublicUrl(thumbKey),
        ...(meta.width ? { width: meta.width } : {}),
        ...(meta.height ? { height: meta.height } : {}),
      },
    });
  }

  private async downloadObject(key: string): Promise<Buffer> {
    const response = await this.mediaService.getClient().send(
      new GetObjectCommand({ Bucket: this.mediaService.getBucket(), Key: key }),
    );
    const bytes = await response.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  private async uploadObject(key: string, body: Buffer): Promise<void> {
    await this.mediaService.getClient().send(
      new PutObjectCommand({
        Bucket: this.mediaService.getBucket(),
        Key: key,
        Body: body,
        ContentType: 'image/webp',
      }),
    );
  }
}
