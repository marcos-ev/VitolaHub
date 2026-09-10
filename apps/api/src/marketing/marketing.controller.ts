import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CreateContactDto } from './dto/create-contact.dto';
import { MarketingService } from './marketing.service';

@Controller({ path: 'contact', version: '1' })
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  /**
   * Formulários públicos do site (contato / fundador).
   * Sem JWT — throttle agressivo anti-spam.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(@Body() dto: CreateContactDto) {
    return this.marketingService.submitContact(dto);
  }
}
