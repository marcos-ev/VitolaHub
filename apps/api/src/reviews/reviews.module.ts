import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { CigarReviewsController } from './cigar-reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController, CigarReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
