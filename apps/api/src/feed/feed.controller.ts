import { Controller, Get, Inject, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { FEED_ASSEMBLER, FeedAssembler } from './feed-assembler.interface';

@Controller({ path: 'feed', version: '1' })
export class FeedController {
  constructor(@Inject(FEED_ASSEMBLER) private readonly feedAssembler: FeedAssembler) {}

  @Get('following')
  following(@CurrentUser() user: RequestUser, @Query('cursor') cursor?: string) {
    return this.feedAssembler.assembleFollowingFeed(user.id, cursor);
  }

  @Get('for-you')
  forYou(@CurrentUser() user: RequestUser, @Query('cursor') cursor?: string) {
    return this.feedAssembler.assembleForYouFeed(user.id, cursor);
  }
}
