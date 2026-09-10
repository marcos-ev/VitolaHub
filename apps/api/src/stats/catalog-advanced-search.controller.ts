import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@charuto/shared';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequireFeature } from '../entitlements/decorators/require-feature.decorator';
import { StatsService } from './stats.service';
import { SearchAdvancedDto } from './dto/search-advanced.dto';

/**
 * Endpoint SEPARADO do `CatalogController` (mesmo prefixo de rota `catalog`,
 * arquivo próprio) para os filtros avançados de busca (seção 6.2, recurso
 * Premium). Ver `StatsService.searchAdvanced` para a justificativa completa
 * de não editar o `$queryRaw` combinado de `CatalogService.search`.
 */
@Controller({ path: 'catalog', version: '1' })
export class CatalogAdvancedSearchController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(EntitlementsGuard)
  @RequireFeature(FeatureKey.ADVANCED_SEARCH_FILTERS)
  @Get('cigars/search-advanced')
  searchAdvanced(@Query() query: SearchAdvancedDto, @CurrentUser() user: RequestUser) {
    return this.statsService.searchAdvanced(user.id, query);
  }
}
