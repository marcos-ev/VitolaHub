import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchCigarsDto {
  @IsString()
  @MinLength(2, { message: 'Informe ao menos 2 caracteres para buscar' })
  q!: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
