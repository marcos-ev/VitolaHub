import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { HumidorController } from './humidor.controller';
import { HumidorService } from './humidor.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [HumidorController],
  providers: [HumidorService],
  exports: [HumidorService],
})
export class HumidorModule {}
