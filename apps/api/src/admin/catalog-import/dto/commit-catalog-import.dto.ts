import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Uma linha já normalizada/ajustada pelo admin na tela de pré-visualização.
// Optamos por receber o payload processado completo de volta no commit (em
// vez de um `importToken` guardado em cache) — mais simples e sem estado,
// dispensando reprocessar o arquivo original.
export class CommitCatalogImportRowDto {
  // Quando true, a linha é ignorada no commit (ex.: admin decidiu não
  // importar uma possível duplicata sinalizada no preview).
  @IsOptional()
  @IsBoolean()
  skip?: boolean;

  @IsString()
  @MinLength(1)
  brandName!: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsString()
  @Length(2, 2, { message: 'countryCode deve ser um código ISO-3166 alpha-2' })
  countryCode!: string;

  @IsOptional()
  @IsString()
  line?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  vitola?: string;

  @IsOptional()
  @IsNumber()
  lengthMm?: number;

  @IsOptional()
  @IsInt()
  ringGauge?: number;

  @IsOptional()
  @IsInt()
  strength?: number;

  @IsOptional()
  @IsString()
  wrapper?: string;

  @IsOptional()
  @IsInt()
  avgSmokeMinutes?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CommitCatalogImportDto {
  // Usado para compor `Cigar.source` (`import:{fileName}`) — é também parte
  // da chave de correspondência da reimportação idempotente.
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitCatalogImportRowDto)
  rows!: CommitCatalogImportRowDto[];
}
