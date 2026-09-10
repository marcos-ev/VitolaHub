import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { ResponseMetricsCron } from './response-metrics.cron';

@Module({
  controllers: [ShopsController],
  providers: [ShopsService, ResponseMetricsCron],
  exports: [ShopsService],
})
export class ShopsModule {}
