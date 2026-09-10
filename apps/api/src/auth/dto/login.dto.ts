import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * Aceita e-mail OU nome de usuário (mockups: "Nome de usuário ou e-mail").
   * Mantém `email` como alias legado para clientes antigos.
   */
  @IsOptional()
  @IsString()
  @MinLength(3)
  identifier?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class SocialLoginDto {
  @IsString()
  idToken!: string;

  @IsString()
  installationId?: string;
}
