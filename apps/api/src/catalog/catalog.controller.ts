import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, OptionalCurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { CatalogService } from './catalog.service';
import { SearchCigarsDto } from './dto/search-cigars.dto';
import { SuggestCigarDto } from './dto/suggest-cigar.dto';

@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('cigars/search')
  search(@Query() query: SearchCigarsDto, @OptionalCurrentUser() user: RequestUser | null) {
    return this.catalogService.search(query.q, query.cursor, user?.id ?? null);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('cigars/:id')
  getById(@Param('id') id: string, @OptionalCurrentUser() user: RequestUser | null) {
    return this.catalogService.getById(id, user?.id ?? null);
  }

  @Post('cigars/suggest')
  suggest(@CurrentUser() user: RequestUser, @Body() dto: SuggestCigarDto) {
    return this.catalogService.suggest(user.id, dto);
  }
}
