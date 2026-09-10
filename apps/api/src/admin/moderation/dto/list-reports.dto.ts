import { ReportEntityType, ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListReportsDto {
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'status inválido' })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportEntityType, { message: 'entityType inválido' })
  entityType?: ReportEntityType;

  @IsOptional()
  @IsString()
  cursor?: string;
}
