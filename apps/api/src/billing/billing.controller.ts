import { Body, Controller, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  checkout(@CurrentUser() user: RequestUser, @Body() dto: CheckoutDto) {
    return this.billingService.checkout(user.id, dto);
  }

  // Rota pública (assinatura Stripe é a autenticação). Precisa do corpo BRUTO
  // da requisição para validar a assinatura — ver `rawBody: true` em
  // `main.ts`, que popula `req.rawBody` para todas as rotas.
  @Public()
  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.billingService.handleWebhook(req.rawBody, signature);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: RequestUser) {
    return this.billingService.cancelSubscription(user.id);
  }
}
