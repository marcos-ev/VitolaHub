import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Filtros avançados de busca (seção 6.2 — recurso Premium). Reaproveita o
 * termo de busca textual do catálogo (`q`) e acrescenta filtros estruturados
 * aplicados em cima do resultado do `CatalogService.search` (ver
 * `CatalogAdvancedSearchController`/`StatsService.searchAdvanced` para a
 * justificativa de não tocar no SQL raw da busca principal).
 */
export class SearchAdvancedDto {
  @IsString()
  @MinLength(2, { message: 'Informe ao menos 2 caracteres para buscar' })
  q!: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'countryCode deve ser um código ISO-3166 alpha-2' })
  countryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minStrength?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxStrength?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vitola?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
}
