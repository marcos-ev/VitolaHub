import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { StatsController } from './stats.controller';
import { CatalogAdvancedSearchController } from './catalog-advanced-search.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [CatalogModule, EntitlementsModule],
  controllers: [StatsController, CatalogAdvancedSearchController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
