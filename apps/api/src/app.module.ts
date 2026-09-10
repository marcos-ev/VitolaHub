import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { MailerModule } from './mailer/mailer.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MediaModule } from './media/media.module';
import { VisibilityModule } from './common/visibility/visibility.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { PostsModule } from './posts/posts.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FeedModule } from './feed/feed.module';
import { AchievementsModule } from './achievements/achievements.module';
import { HumidorModule } from './humidor/humidor.module';
import { InvitesModule } from './invites/invites.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { BillingModule } from './billing/billing.module';
import { ShopsModule } from './shops/shops.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { RecognitionModule } from './recognition/recognition.module';
import { StatsModule } from './stats/stats.module';
import { SupportModule } from './support/support.module';
import { MarketingModule } from './marketing/marketing.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AppLogger } from './common/logger/app-logger.service';

// Módulos de feature das Fases 1-4 (catálogo, posts/reviews, feed,
// conquistas, umidor, explorar, convites, billing, charutarias/chat, admin,
// reconhecimento) se registram aqui conforme implementados, mantendo o
// monólito modular único previsto na seção "O que não fazer".
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    QueueModule,
    MailerModule,
    NotificationsModule,
    MediaModule,
    VisibilityModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    PostsModule,
    ReviewsModule,
    FeedModule,
    AchievementsModule,
    HumidorModule,
    InvitesModule,
    EntitlementsModule,
    BillingModule,
    ShopsModule,
    ChatModule,
    AdminModule,
    RecognitionModule,
    StatsModule,
    SupportModule,
    MarketingModule,
    HealthModule,
  ],
  providers: [
    AppLogger,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
