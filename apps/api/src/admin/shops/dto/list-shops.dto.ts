import { ShopPlan } from '@prisma/client';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListShopsDto {
  @IsOptional()
  @IsEnum(ShopPlan, { message: 'plan inválido' })
  plan?: ShopPlan;

  // Vem como string na querystring ("true"/"false"); IsBooleanString valida
  // o formato e o controller converte antes de repassar ao service.
  @IsOptional()
  @IsBooleanString({ message: 'isVerified deve ser "true" ou "false"' })
  isVerified?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
