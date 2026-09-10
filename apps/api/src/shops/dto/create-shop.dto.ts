import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Validação fina do CNPJ (apenas quantidade de dígitos) fica no service, que
// normaliza a string removendo máscara antes de gravar — assim aceitamos
// tanto "12.345.678/0001-90" quanto "12345678000190" vindos do app.
export class CreateShopDto {
  @IsString()
  @MinLength(11)
  @MaxLength(18)
  cnpj!: string;

  @IsString()
  @MaxLength(150)
  tradeName!: string;

  @IsString()
  @MaxLength(300)
  address!: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instagram?: string;

  // Formato livre, ex.: { "mon": ["09:00","18:00"], "tue": [...], "sun": null }
  @IsOptional()
  @IsObject()
  hours?: Record<string, unknown>;
}
