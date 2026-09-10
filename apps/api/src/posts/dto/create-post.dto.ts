import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// A foto nunca passa pelo backend (seção 2/8): o cliente já subiu o arquivo
// direto pro S3/MinIO via `POST /media/presign` e manda aqui apenas a chave
// do objeto (`objectKey`) + as dimensões originais que ele já conhece
// localmente. O processamento (thumb/feed/original em WebP) é assíncrono.
export class PostMediaItemDto {
  @IsString()
  objectKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  width!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  height!: number;
}

// Subconjunto de CreateReviewDto (reviews/dto/create-review.dto.ts) sem
// cigarId/postId — esses vêm do contexto do post ao qual a review é anexada.
export class CreateReviewInPostDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  perceivedStrength!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  smokeMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  draw?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  burn?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pairedWith?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  flavorNoteIds?: string[];
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsUUID()
  cigarId?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'FRIENDS'])
  visibility?: 'PUBLIC' | 'FRIENDS';

  @IsArray()
  @ArrayMinSize(1, { message: 'Um post precisa de ao menos uma foto' })
  @ValidateNested({ each: true })
  @Type(() => PostMediaItemDto)
  media!: PostMediaItemDto[];

  // Fluxo "avaliar com post": exige cigarId quando informado.
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateReviewInPostDto)
  review?: CreateReviewInPostDto;
}
