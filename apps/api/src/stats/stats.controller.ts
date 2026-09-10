import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { FeatureKey } from '@charuto/shared';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequireFeature } from '../entitlements/decorators/require-feature.decorator';
import { StatsService } from './stats.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { CompareCigarsDto } from './dto/compare-cigars.dto';
import { ExportQueryDto } from './dto/export-query.dto';

@Controller({ path: 'stats', version: '1' })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(EntitlementsGuard)
  @RequireFeature(FeatureKey.TASTE_STATS)
  @Get('taste-profile')
  getTasteProfile(@CurrentUser() user: RequestUser) {
    return this.statsService.getTasteProfile(user.id);
  }

  // Sem @RequireFeature: a rota é acessível a qualquer usuário autenticado,
  // mas o CONTEÚDO é filtrado dentro do service quando falta
  // `FeatureKey.REVIEW_HISTORY_FULL` (ver StatsService.getHistory).
  @Get('history')
  getHistory(@CurrentUser() user: RequestUser, @Query() query: HistoryQueryDto) {
    return this.statsService.getHistory(user.id, query.cursor);
  }

  @UseGuards(EntitlementsGuard)
  @RequireFeature(FeatureKey.COMPARE_CIGARS)
  @Get('compare')
  compare(@CurrentUser() user: RequestUser, @Query() query: CompareCigarsDto) {
    return this.statsService.compare(user.id, query.cigarIds);
  }

  @UseGuards(EntitlementsGuard)
  @RequireFeature(FeatureKey.EXPORT_CSV_PDF)
  @Get('export')
  async export(
    @CurrentUser() user: RequestUser,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (query.format === 'csv') {
      const csv = await this.statsService.exportCsv(user.id);
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="avaliacoes.csv"',
      });
      return csv;
    }

    // format === 'pdf': stand-in documentado em HTML (ver StatsService.exportPdfHtml).
    const html = await this.statsService.exportPdfHtml(user.id);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    return html;
  }
}
