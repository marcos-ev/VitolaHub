import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Min, MinLength } from 'class-validator';

// Edição administrativa da ficha do charuto (correção de dados antes/depois
// da aprovação) — todos os campos opcionais, só atualiza o que for enviado.
export class UpdateCigarDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  line?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'countryCode deve ser um código ISO-3166 alpha-2' })
  countryCode?: string;

  @IsOptional()
  @IsString()
  vitola?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lengthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  ringGauge?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  strength?: number;

  @IsOptional()
  @IsString()
  wrapper?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  avgSmokeMinutes?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
