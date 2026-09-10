import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShopsService } from './shops.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ListShopsDto } from './dto/list-shops.dto';
import { CreateShopReviewDto } from './dto/create-shop-review.dto';
import { ReportShopDto } from './dto/report-shop.dto';

const DEFAULT_RADIUS_KM = 20;

@Controller({ path: 'shops', version: '1' })
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateShopDto) {
    return this.shopsService.create(user.id, dto);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateShopDto) {
    return this.shopsService.updateMe(user.id, dto);
  }

  // Público: visitante não autenticado também pode buscar lojas próximas.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  search(@Query() query: ListShopsDto) {
    return this.shopsService.searchNearby({
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm ?? DEFAULT_RADIUS_KM,
      city: query.city,
      cursorRaw: query.cursor,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.shopsService.getById(id);
  }

  @Post(':id/reviews')
  review(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateShopReviewDto) {
    return this.shopsService.createOrUpdateReview(id, user.id, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/reviews')
  listReviews(@Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.shopsService.listReviews(id, cursor);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ReportShopDto) {
    await this.shopsService.report(id, user.id, dto.reason);
  }
}
