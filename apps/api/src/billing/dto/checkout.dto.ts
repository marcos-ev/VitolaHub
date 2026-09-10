import { IsIn } from 'class-validator';

export type BillingPlan = 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY' | 'SHOP_MONTHLY';
export type BillingPaymentMethod = 'card' | 'pix';

export class CheckoutDto {
  @IsIn(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY', 'SHOP_MONTHLY'])
  plan!: BillingPlan;

  @IsIn(['card', 'pix'])
  paymentMethod!: BillingPaymentMethod;
}
