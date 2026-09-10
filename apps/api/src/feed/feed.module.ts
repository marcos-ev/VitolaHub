import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FEED_ASSEMBLER } from './feed-assembler.interface';
import { FanOutOnReadFeedAssembler } from './fan-out-on-read-feed-assembler.service';

@Module({
  controllers: [FeedController],
  providers: [{ provide: FEED_ASSEMBLER, useClass: FanOutOnReadFeedAssembler }],
  exports: [FEED_ASSEMBLER],
})
export class FeedModule {}
