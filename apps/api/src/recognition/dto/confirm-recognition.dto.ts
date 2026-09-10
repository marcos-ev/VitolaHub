import { IsOptional, IsUUID } from 'class-validator';

/**
 * `cigarId` ausente/`null` indica que nenhum candidato bateu e o usuário vai
 * seguir para a busca manual — `@IsOptional()` aceita tanto `null` quanto o
 * campo omitido, além de um uuid válido.
 */
export class ConfirmRecognitionDto {
  @IsOptional()
  @IsUUID()
  cigarId?: string | null;
}
