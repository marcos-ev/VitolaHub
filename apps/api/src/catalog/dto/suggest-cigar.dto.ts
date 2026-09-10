import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Min, MinLength } from 'class-validator';

export class SuggestCigarDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  line?: string;

  // Ao menos um dos dois deve ser informado (validado no service): marca já
  // cadastrada (brandId) ou nome de marca nova/existente por nome (brandName).
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  brandName?: string;

  @IsString()
  @Length(2, 2, { message: 'countryCode deve ser um código ISO-3166 alpha-2' })
  countryCode!: string;

  @IsOptional()
  @IsString()
  vitola?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ringGauge?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lengthMm?: number;

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
