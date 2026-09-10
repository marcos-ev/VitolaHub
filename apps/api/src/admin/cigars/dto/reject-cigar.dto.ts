import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCigarDto {
  // Não há campo no schema (`Cigar`) para persistir o motivo da rejeição —
  // aceito aqui apenas para eventual log/auditoria futura, mas não é gravado
  // em nenhuma coluna hoje (limitação documentada no resumo final).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
