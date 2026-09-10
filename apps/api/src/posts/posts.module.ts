import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { MediaProcessingProcessor } from './media-processing.processor';
import { IMAGE_MODERATION_SERVICE, PermissiveImageModerationService } from './image-moderation.service';

@Module({
  imports: [ReviewsModule],
  controllers: [PostsController],
  providers: [
    PostsService,
    MediaProcessingProcessor,
    { provide: IMAGE_MODERATION_SERVICE, useClass: PermissiveImageModerationService },
  ],
  exports: [PostsService],
})
export class PostsModule {}
