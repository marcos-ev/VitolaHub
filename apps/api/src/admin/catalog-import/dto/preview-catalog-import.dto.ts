import { IsIn, IsOptional } from 'class-validator';

// Campo de texto adicional enviado junto do arquivo no multipart/form-data
// (seção 5.3): unidade padrão de comprimento para linhas sem indicador
// explícito ("in"/polegadas) na própria célula.
export class PreviewCatalogImportDto {
  @IsOptional()
  @IsIn(['mm', 'in'], { message: 'lengthUnit deve ser "mm" ou "in"' })
  lengthUnit?: 'mm' | 'in';
}
