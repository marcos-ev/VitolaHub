import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

// Campos que a própria loja pode editar em seu perfil (endereço, contato,
// horário de atendimento e mensagem automática de saudação). `tradeName` e
// `cnpj` não são editáveis aqui de propósito — mudança de razão social/CNPJ
// fica fora do escopo desta fase.
export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instagram?: string;

  @IsOptional()
  @IsObject()
  hours?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greetingMessage?: string;
}
