import { BadRequestException } from '@nestjs/common';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Formato mínimo do arquivo recebido via `FileInterceptor('file')` — não
// dependemos do tipo `Express.Multer.File` (que exigiria `@types/multer`,
// não instalado no projeto) porque só usamos estes três campos.
export interface UploadedImportFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export type RawImportRow = Record<string, string>;

function isExcel(file: UploadedImportFile): boolean {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return true;
  return (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel'
  );
}

function isCsv(file: UploadedImportFile): boolean {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) return true;
  return file.mimetype === 'text/csv' || file.mimetype === 'application/csv';
}

// Normaliza a chave do cabeçalho (minúsculo, sem espaço nas pontas) para
// tolerar pequenas variações de digitação da planilha do admin.
function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Faz o parse do arquivo de importação (CSV via papaparse, XLSX via xlsx —
 * seção 5.3, ambos já instalados no projeto) e devolve linhas cruas com
 * chaves normalizadas, prontas para a etapa de normalização de campos.
 */
export function parseImportFile(file: UploadedImportFile): RawImportRow[] {
  if (isCsv(file)) {
    const text = file.buffer.toString('utf8');
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeaderKey,
    });
    if (parsed.errors?.length) {
      throw new BadRequestException(`Falha ao ler CSV: ${parsed.errors[0].message}`);
    }
    return parsed.data;
  }

  if (isExcel(file)) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new BadRequestException('Planilha XLSX sem nenhuma aba');
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
    return rows.map((row) => {
      const normalized: RawImportRow = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeaderKey(key)] = value === undefined || value === null ? '' : String(value);
      }
      return normalized;
    });
  }

  throw new BadRequestException('Formato de arquivo não suportado — envie um .csv ou .xlsx');
}
