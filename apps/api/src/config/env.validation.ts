import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  REDIS_URL!: string;

  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  // Reconhecimento do charuto por foto (seção 5.7) — opcional de propósito:
  // o app precisa continuar funcionando (com fallback para busca manual) em
  // dev/test mesmo sem uma chave da Anthropic configurada.
  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Variáveis de ambiente inválidas ou ausentes: ${errors
        .map((e) => e.property)
        .join(', ')}`,
    );
  }
  return validated;
}
