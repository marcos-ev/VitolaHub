import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

/**
 * Upload por URL pré-assinada (seção 2): a imagem nunca trafega pelo
 * backend. O cliente pede a URL aqui e envia o arquivo direto para o
 * storage S3-compatível (MinIO em dev, Cloudflare R2/S3 em produção).
 */
@Injectable()
export class MediaService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET')!;
    this.publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL')!;
    this.s3 = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      region: this.config.get<string>('S3_REGION') ?? 'auto',
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async createPresignedUpload(
    folder: 'avatars' | 'posts' | 'shops' | 'recognition' | 'support',
    contentType: string,
  ): Promise<PresignedUpload> {
    const extension = contentType.split('/')[1] ?? 'jpg';
    const objectKey = `${folder}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return {
      uploadUrl,
      publicUrl: this.buildPublicUrl(objectKey),
      objectKey,
    };
  }

  buildPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl}/${objectKey}`;
  }

  /** Reaproveitado pelo processor de mídia (posts) para baixar/subir os arquivos processados. */
  getClient(): S3Client {
    return this.s3;
  }

  getBucket(): string {
    return this.bucket;
  }
}
