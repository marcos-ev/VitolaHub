import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('admin1234', { type: argon2.argon2id });
  const premiumUntil = new Date();
  premiumUntil.setFullYear(premiumUntil.getFullYear() + 5);

  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      isAdmin: true,
      passwordHash,
      status: 'ACTIVE',
      deletedAt: null,
      subscriptionStatus: 'ACTIVE',
      trialStartedAt: new Date(),
      trialEndsAt: premiumUntil,
      email: 'admin@vitolahub.app',
      displayName: 'Admin Vitola',
    },
    create: {
      email: 'admin@vitolahub.app',
      username: 'admin',
      displayName: 'Admin Vitola',
      passwordHash,
      birthDate: new Date('1990-01-01'),
      isAdmin: true,
      accountType: 'PF',
      taxId: '39053344705',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      trialStartedAt: new Date(),
      trialEndsAt: premiumUntil,
    },
  });

  await prisma.subscription.deleteMany({
    where: { userId: user.id, providerRef: 'dev-admin-premium' },
  });
  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: 'PREMIUM_YEARLY',
      status: 'ACTIVE',
      provider: 'STRIPE',
      providerRef: 'dev-admin-premium',
      currentPeriodEnd: premiumUntil,
    },
  });

  await prisma.entitlement.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      isPremium: true,
      isTrial: false,
      trialEndsAt: null,
      premiumUntil,
      resolvedAt: new Date(),
    },
    update: {
      isPremium: true,
      isTrial: false,
      trialEndsAt: null,
      premiumUntil,
      resolvedAt: new Date(),
    },
  });

  console.log(JSON.stringify({ username: user.username, isAdmin: user.isAdmin, premiumUntil }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
