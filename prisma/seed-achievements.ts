// Seed do catálogo de conquistas (seção 5.4). Arquivo standalone e
// autoexecutável via `tsx prisma/seed-achievements.ts` (rodar a partir da
// raiz do monorepo, onde `tsx` está disponível como devDependency).
//
// Se/quando existir um `prisma/seed.ts` principal (ex.: criado por outro
// agente responsável pelo catálogo de charutos), ele pode reaproveitar este
// arquivo importando e chamando `seedAchievements(prisma)` com sua própria
// instância de PrismaClient, em vez de duplicar a lista de selos:
//
//   import { PrismaClient } from '@prisma/client';
//   import { seedAchievements } from './seed-achievements';
//
//   const prisma = new PrismaClient();
//   async function main() {
//     await seedAchievements(prisma);
//     // ...demais seeds (marcas, charutos, flavor notes, etc.)
//   }
//
// Rodando este arquivo diretamente (`tsx prisma/seed-achievements.ts`) ele
// também funciona sozinho, criando sua própria conexão Prisma.

import { PrismaClient } from '@prisma/client';

export interface AchievementSeedRow {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  rule: Record<string, unknown>;
}

// Ícones em nomes do Ionicons (o mobile usa @expo/vector-icons/Ionicons).
export const ACHIEVEMENT_SEEDS: AchievementSeedRow[] = [
  {
    code: 'FIRST_REVIEW',
    name: 'Primeira Avaliação',
    description: 'Avalie seu primeiro charuto.',
    icon: 'medal',
    tier: 1,
    rule: { type: 'count', event: 'REVIEW_CREATED', target: 1 },
  },
  {
    code: 'REVIEWS_5',
    name: '5 Avaliações',
    description: 'Avalie 5 charutos.',
    icon: 'star',
    tier: 1,
    rule: { type: 'count', event: 'REVIEW_CREATED', target: 5 },
  },
  {
    code: 'REVIEWS_25',
    name: '25 Avaliações',
    description: 'Avalie 25 charutos.',
    icon: 'star',
    tier: 2,
    rule: { type: 'count', event: 'REVIEW_CREATED', target: 25 },
  },
  {
    code: 'REVIEWS_100',
    name: '100 Avaliações',
    description: 'Avalie 100 charutos.',
    icon: 'trophy',
    tier: 3,
    rule: { type: 'count', event: 'REVIEW_CREATED', target: 100 },
  },
  {
    code: 'COUNTRIES_3',
    name: '3 Países',
    description: 'Avalie charutos de 3 países diferentes.',
    icon: 'earth',
    tier: 1,
    rule: { type: 'distinct_count', event: 'REVIEW_CREATED', field: 'cigar.country_code', target: 3 },
  },
  {
    code: 'COUNTRIES_5',
    name: '5 Países',
    description: 'Avalie charutos de 5 países diferentes.',
    icon: 'earth',
    tier: 2,
    rule: { type: 'distinct_count', event: 'REVIEW_CREATED', field: 'cigar.country_code', target: 5 },
  },
  {
    code: 'COUNTRIES_10',
    name: '10 Países',
    description: 'Avalie charutos de 10 países diferentes.',
    icon: 'earth',
    tier: 3,
    rule: { type: 'distinct_count', event: 'REVIEW_CREATED', field: 'cigar.country_code', target: 10 },
  },
  {
    code: 'VITOLAS_5',
    name: '5 Bitolas',
    description: 'Avalie charutos de 5 bitolas diferentes.',
    icon: 'shapes',
    tier: 1,
    rule: { type: 'distinct_count', event: 'REVIEW_CREATED', field: 'cigar.vitola', target: 5 },
  },
  {
    code: 'FRIENDS_10',
    name: '10 Amigos',
    description: 'Faça 10 amigos no Vitola Hub.',
    icon: 'people',
    tier: 1,
    rule: { type: 'count', event: 'FOLLOW_ACCEPTED', target: 10 },
  },
  {
    code: 'FRIENDS_50',
    name: '50 Amigos',
    description: 'Faça 50 amigos no Vitola Hub.',
    icon: 'people',
    tier: 2,
    rule: { type: 'count', event: 'FOLLOW_ACCEPTED', target: 50 },
  },
  {
    code: 'FRIENDS_100',
    name: '100 Amigos',
    description: 'Faça 100 amigos no Vitola Hub.',
    icon: 'people',
    tier: 3,
    rule: { type: 'count', event: 'FOLLOW_ACCEPTED', target: 100 },
  },
  {
    code: 'HUMIDOR_5',
    name: '5 Charutos no Umidor',
    description: 'Adicione 5 charutos ao seu umidor.',
    icon: 'file-tray-full',
    tier: 1,
    rule: { type: 'count', event: 'HUMIDOR_ITEM_ADDED', target: 5 },
  },
  {
    code: 'HUMIDOR_25',
    name: '25 Charutos no Umidor',
    description: 'Adicione 25 charutos ao seu umidor.',
    icon: 'file-tray-full',
    tier: 2,
    rule: { type: 'count', event: 'HUMIDOR_ITEM_ADDED', target: 25 },
  },
  {
    code: 'FIRST_SUGGESTION_APPROVED',
    name: 'Primeira Sugestão Aprovada',
    description: 'Tenha uma sugestão de charuto aprovada no catálogo.',
    icon: 'checkmark-circle',
    tier: 1,
    rule: { type: 'count', event: 'CIGAR_SUGGESTION_APPROVED', target: 1 },
  },
  {
    code: 'STREAK_4_WEEKS',
    name: '4 Semanas Seguidas',
    description: 'Registre uma avaliação por 4 semanas seguidas.',
    icon: 'flame',
    tier: 2,
    rule: { type: 'streak_weeks', event: 'REVIEW_CREATED', target: 4 },
  },
];

export async function seedAchievements(prisma: PrismaClient): Promise<void> {
  for (const achievement of ACHIEVEMENT_SEEDS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: {
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        rule: achievement.rule,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seed de conquistas concluído: ${ACHIEVEMENT_SEEDS.length} selo(s).`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAchievements(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
