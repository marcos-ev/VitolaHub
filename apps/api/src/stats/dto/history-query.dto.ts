import { IsOptional, IsString } from 'class-validator';

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;
}
