import { IsString, MinLength } from 'class-validator';

/**
 * `cigarIds` chega como CSV na query string (ex.: `?cigarIds=id1,id2,id3`) —
 * o parse para array e a validação de quantidade (2 a 4 charutos) ficam no
 * `StatsService.compare`, já que dependem de regra de negócio, não só de
 * formato.
 */
export class CompareCigarsDto {
  @IsString()
  @MinLength(1, { message: 'Informe cigarIds separados por vírgula (ex.: ?cigarIds=id1,id2)' })
  cigarIds!: string;
}
