import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max } from 'class-validator';

// `brandId` é aceito por compatibilidade com o enunciado, mas não filtra
// resultados nesta fase — ver limitação documentada em ShopsService.searchNearby.
export class ListShopsDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(500)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
