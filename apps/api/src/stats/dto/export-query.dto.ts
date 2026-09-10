import { IsIn } from 'class-validator';

export type ExportFormat = 'csv' | 'pdf';

export class ExportQueryDto {
  @IsIn(['csv', 'pdf'], { message: 'format deve ser "csv" ou "pdf"' })
  format!: ExportFormat;
}
