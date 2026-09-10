import { IsOptional, IsString } from 'class-validator';

export class ListPendingCigarsDto {
  @IsOptional()
  @IsString()
  cursor?: string;
}
