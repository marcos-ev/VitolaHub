import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { BillingPlan, CheckoutDto } from './dto/checkout.dto';

// Valores em centavos (seção 6.1): Premium PF mensal R$9,90, anual R$79,
// Loja (PJ) mensal R$99,90. Usados apenas no fluxo PIX (PaymentIntent), que
// exige `amount` explícito — o fluxo de cartão usa os Price IDs do Stripe.
const PLAN_AMOUNT_CENTS: Record<BillingPlan, number> = {
  PREMIUM_MONTHLY: 990,
  PREMIUM_YEARLY: 7900,
  SHOP_MONTHLY: 9990,
};

// PIX (seção 6.1): "só pro plano anual PF e pro plano PJ mensal".
const PIX_ALLOWED_PLANS: BillingPlan[] = ['PREMIUM_YEARLY', 'SHOP_MONTHLY'];

interface UpsertSubscriptionInput {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  providerRef: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Billing via Stripe (seção 6.1, 6.2, 6.4). O backend é sempre a fonte de
 * verdade: toda mudança de acesso Premium nasce de um webhook validado por
 * assinatura, nunca de uma resposta de sucesso do cliente. `STRIPE_SECRET_KEY`
 * pode estar vazia em dev — o client Stripe simplesmente não é inicializado
 * e qualquer chamada real lança `ServiceUnavailableException` em vez de
 * quebrar o boot da aplicação.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY não configurada — módulo de billing subiu normalmente, mas chamadas reais ao Stripe vão falhar até a chave ser definida.',
      );
    }
  }

  async checkout(userId: string, dto: CheckoutDto) {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (dto.paymentMethod === 'pix') {
      return this.checkoutWithPix(stripe, userId, user.email, dto.plan);
    }
    return this.checkoutWithCard(stripe, userId, user.email, dto.plan);
  }

  private async checkoutWithPix(stripe: Stripe, userId: string, email: string, plan: BillingPlan) {
    if (!PIX_ALLOWED_PLANS.includes(plan)) {
      throw new BadRequestException('PIX está disponível apenas para o plano anual PF ou o plano mensal PJ');
    }

    const intent = await stripe.paymentIntents.create({
      amount: PLAN_AMOUNT_CENTS[plan],
      currency: 'brl',
      payment_method_types: ['pix'],
      receipt_email: email,
      metadata: { userId, plan },
    });

    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  private async checkoutWithCard(stripe: Stripe, userId: string, email: string, plan: BillingPlan) {
    const priceId = this.priceIdFor(plan);
    const webAppUrl = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:8081';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
      success_url: `${webAppUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${webAppUrl}/billing/cancel`,
    });

    return { url: session.url, sessionId: session.id };
  }

  /**
   * Valida a assinatura do webhook com `STRIPE_WEBHOOK_SECRET` contra o
   * corpo BRUTO da requisição (por isso o parâmetro é `Buffer`, não JSON já
   * parseado — ver `main.ts`/`billing.controller.ts`). Toda mudança de
   * `Subscription`/`User.subscriptionStatus` acontece aqui, e o cache de
   * entitlements é invalidado explicitamente em cada caso.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ received: true }> {
    const stripe = this.requireStripe();
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!rawBody || !signature || !webhookSecret) {
      throw new BadRequestException('Webhook do Stripe mal configurado ou requisição inválida');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException(`Assinatura de webhook inválida: ${(error as Error).message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Evento do Stripe ignorado: ${event.type}`);
    }

    return { received: true };
  }

  /** "Cancelamento mantém acesso até o fim do período pago" — nunca revoga na hora. */
  async cancelSubscription(userId: string): Promise<{ cancelAtPeriodEnd: true }> {
    const stripe = this.requireStripe();
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription?.providerRef) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada para este usuário');
    }

    await stripe.subscriptions.update(subscription.providerRef, { cancel_at_period_end: true });
    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true } });

    return { cancelAtPeriodEnd: true };
  }

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.client_reference_id ?? session.metadata?.userId;
    if (!userId) {
      this.logger.warn(`checkout.session.completed sem userId (session=${session.id})`);
      return;
    }
    const plan = (session.metadata?.plan as SubscriptionPlan) ?? 'PREMIUM_MONTHLY';
    const providerRef =
      (typeof session.subscription === 'string' ? session.subscription : session.subscription?.id) ?? session.id;

    await this.upsertSubscriptionByProviderRef({ userId, plan, status: 'ACTIVE', providerRef });
    await this.prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'ACTIVE' } });
    await this.entitlements.invalidate(userId);
  }

  private async onSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn(`customer.subscription.updated sem userId (subscription=${subscription.id})`);
      return;
    }
    const plan = (subscription.metadata?.plan as SubscriptionPlan) ?? 'PREMIUM_MONTHLY';
    const status = this.mapStripeSubscriptionStatus(subscription.status);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    await this.upsertSubscriptionByProviderRef({
      userId,
      plan,
      status,
      providerRef: subscription.id,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    });
    await this.prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: status } });
    await this.entitlements.invalidate(userId);
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn(`customer.subscription.deleted sem userId (subscription=${subscription.id})`);
      return;
    }
    const plan = (subscription.metadata?.plan as SubscriptionPlan) ?? 'PREMIUM_MONTHLY';

    await this.upsertSubscriptionByProviderRef({ userId, plan, status: 'CANCELED', providerRef: subscription.id });
    await this.prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'CANCELED' } });
    await this.entitlements.invalidate(userId);
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const providerRef = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!providerRef) return;

    const existing = await this.prisma.subscription.findFirst({ where: { providerRef } });
    if (!existing) {
      this.logger.warn(`invoice.payment_failed para subscription desconhecida (${providerRef})`);
      return;
    }

    await this.prisma.subscription.update({ where: { id: existing.id }, data: { status: 'PAST_DUE' } });
    await this.prisma.user.update({ where: { id: existing.userId }, data: { subscriptionStatus: 'PAST_DUE' } });
    await this.entitlements.invalidate(existing.userId);
  }

  /**
   * `Subscription.providerRef` não tem constraint `@unique` no schema (não
   * pudemos alterar `prisma/schema.prisma`), então não é possível usar
   * `prisma.subscription.upsert({ where: { providerRef } })` diretamente —
   * o Prisma só aceita campos únicos/PK na cláusula `where` de upsert. Por
   * isso fazemos find + create/update manualmente aqui. Isso abre uma janela
   * de corrida teórica entre webhooks quase simultâneos para a mesma
   * subscription — aceitável neste estágio, mas o ideal seria uma migration
   * futura adicionando `@@unique([providerRef])`.
   */
  private async upsertSubscriptionByProviderRef(input: UpsertSubscriptionInput): Promise<Subscription> {
    const existing = await this.prisma.subscription.findFirst({ where: { providerRef: input.providerRef } });
    if (existing) {
      return this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: input.plan,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        },
      });
    }
    return this.prisma.subscription.create({
      data: {
        userId: input.userId,
        plan: input.plan,
        status: input.status,
        provider: 'STRIPE',
        providerRef: input.providerRef,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
    });
  }

  private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return 'ACTIVE';
      case 'trialing':
        return 'TRIALING';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
      case 'unpaid':
      case 'incomplete_expired':
        return 'CANCELED';
      default:
        return 'NONE';
    }
  }

  private priceIdFor(plan: BillingPlan): string {
    const envKeyByPlan: Record<BillingPlan, string> = {
      PREMIUM_MONTHLY: 'STRIPE_PRICE_PREMIUM_MONTHLY',
      PREMIUM_YEARLY: 'STRIPE_PRICE_PREMIUM_YEARLY',
      SHOP_MONTHLY: 'STRIPE_PRICE_SHOP_MONTHLY',
    };
    const envKey = envKeyByPlan[plan];
    const priceId = this.config.get<string>(envKey);
    if (!priceId) {
      throw new ServiceUnavailableException(`Price ID do Stripe não configurado para o plano ${plan} (${envKey})`);
    }
    return priceId;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe não está configurado neste ambiente (STRIPE_SECRET_KEY vazio)');
    }
    return this.stripe;
  }
}