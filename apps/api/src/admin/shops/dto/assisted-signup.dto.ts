import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

// Contratação assistida PJ (seção 6 — plano PJ não tem trial self-service):
// um admin cadastra a loja em nome de um usuário PJ já existente. O dono
// (ou o admin em nome dele) chama o checkout já existente em
// `apps/api/src/billing/**` depois disso — não implementado aqui.
export class AssistedShopSignupDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(11, { message: 'cnpj inválido' })
  cnpj!: string;

  @IsString()
  @MinLength(2)
  tradeName!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  instagram?: string;
}
