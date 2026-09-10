import { Module } from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { AdminModerationController } from './moderation/admin-moderation.controller';
import { AdminModerationService } from './moderation/admin-moderation.service';
import { AdminCigarsController } from './cigars/admin-cigars.controller';
import { AdminCigarsService } from './cigars/admin-cigars.service';
import { AdminCatalogImportController } from './catalog-import/admin-catalog-import.controller';
import { AdminCatalogImportService } from './catalog-import/admin-catalog-import.service';
import { AdminShopsController } from './shops/admin-shops.controller';
import { AdminShopsService } from './shops/admin-shops.service';

// Painel administrativo (Fase 3b): moderação (denúncias/posts/usuários),
// aprovação de sugestões de charuto ao catálogo, importador de catálogo
// CSV/XLSX e contratação assistida PJ (lojas parceiras). `PrismaService`,
// `NotificationsService` e `DomainEventsService` são providos por módulos
// `@Global()` (`PrismaModule`, `NotificationsModule`, `QueueModule`) — não
// precisam ser importados aqui.
@Module({
  controllers: [AdminModerationController, AdminCigarsController, AdminCatalogImportController, AdminShopsController],
  providers: [AdminGuard, AdminModerationService, AdminCigarsService, AdminCatalogImportService, AdminShopsService],
})
export class AdminModule {}
