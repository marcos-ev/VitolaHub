import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ReviewsService } from './reviews.service';

@Public()
@Controller({ path: 'cigars', version: '1' })
export class CigarReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':cigarId/reviews')
  listByCigar(@Param('cigarId') cigarId: string, @Query('cursor') cursor?: string) {
    return this.reviewsService.listByCigar(cigarId, cursor);
  }
}
