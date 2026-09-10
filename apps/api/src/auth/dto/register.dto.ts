import { AccountType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  /** Opcional: se omitido, a API gera um e-mail interno a partir do username. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Matches(/^[a-z0-9._]{3,30}$/i, {
    message: 'username deve ter 3-30 caracteres alfanuméricos, ponto ou underscore',
  })
  username!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsDateString()
  birthDate!: string;

  /** CPF (11) ou CNPJ (14), só dígitos. */
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido' })
  taxId!: string;

  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsBoolean()
  acceptedTerms!: boolean;

  @IsOptional()
  @IsString()
  installationId?: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}
