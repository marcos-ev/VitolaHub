import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../guards/admin.guard';
import { AdminCatalogImportService } from './admin-catalog-import.service';
import { UploadedImportFile } from './catalog-import-file.parser';
import { CommitCatalogImportDto } from './dto/commit-catalog-import.dto';
import { PreviewCatalogImportDto } from './dto/preview-catalog-import.dto';

@UseGuards(AdminGuard)
@Controller({ path: 'admin/catalog-import', version: '1' })
export class AdminCatalogImportController {
  constructor(private readonly catalogImportService: AdminCatalogImportService) {}

  // Sem `storage`/`dest` explícitos o multer usa memory storage por padrão
  // (populando `file.buffer`) — dispensa depender de `@types/multer`
  // (não instalado no projeto) ou de disco temporário.
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: UploadedImportFile, @Body() dto: PreviewCatalogImportDto) {
    return this.catalogImportService.preview(file, dto.lengthUnit ?? 'mm');
  }

  @Post('commit')
  commit(@Body() dto: CommitCatalogImportDto) {
    return this.catalogImportService.commit(dto);
  }
}
