import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  cigarId!: string;

  // Preenchido quando a avaliação nasce junto de um post ("avaliar com post").
  @IsOptional()
  @IsUUID()
  postId?: string;

  // Nota 1-5, aceita meio ponto (1, 1.5, 2, ..., 5) — validado no service.
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
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pairedWith?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  flavorNoteIds?: string[];
}
