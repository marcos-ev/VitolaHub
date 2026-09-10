// Seed de dados de demonstração ("vida" no app): usuários fictícios, posts,
// avaliações, follows/amizades, charutarias verificadas e notificações.
//
// Objetivo: permitir testar visualmente feed, explorar, perfis, charutarias e
// a tela de charuto com dados realistas em PT-BR, sem depender de uso real do
// app. NÃO roda em produção — é só para o ambiente local/demo.
//
// Idempotente na medida do possível: usuários fictícios têm e-mails fixos
// (`@demo.vitolahub.com.br`) e são localizados por e-mail antes de criar; se
// já existem, o script pula a criação de usuários mas ainda pode reforçar
// contadores. Para resetar tudo, rode `npm run prisma:seed:demo:reset` (limpa
// só os dados marcados como demo) antes de rodar de novo.
//
// Rodar: `npx tsx prisma/seed-demo.ts` (raiz do monorepo).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL_DOMAIN = 'demo.vitolahub.com.br';

function avatar(seed: number) {
  return `https://i.pravatar.cc/300?img=${seed}`;
}

// Fotos reais e licenciadas (Unsplash, licença livre) com temática de
// charutos/umidor/whisky — usadas nos posts para simular fotos reais de
// momentos de fumar, em vez de fotos aleatórias sem relação com o tema.
const POST_PHOTO_IDS = [
  '1652209804572-91b24a2bbb97', // close-up de charuto
  '1631227852854-7c0fac3c9aeb', // charuto na mesa com whisky
  '1534175164374-ec4b5b62f990', // charuto em foco seletivo
  '1749842482700-f6cbad46943a', // charutos com anéis coloridos
  '1768703137273-8650ed4d8ced', // mão segurando charuto aceso
  '1680266194753-0cf288bf7b93', // homem com charuto e whisky
  '1749842839766-8b71630a627d', // umidor aberto com charutos
  '1749842893762-d94717e28a9f', // charuto com fumaça e drink
  '1612659429508-b429d6b07ac1', // tabaco sobre madeira
];
function postPhoto(id: string, size = 900) {
  return `https://images.unsplash.com/photo-${id}?w=${size}&h=${size}&q=80&auto=format&fit=crop`;
}

interface FakeUserSeed {
  username: string;
  displayName: string;
  bio: string;
  city: string;
  state: string;
  avatarSeed: number;
  isPrivate: boolean;
  premium: boolean;
  ageYears: number;
}

const FAKE_USERS: FakeUserSeed[] = [
  { username: 'ricardo.ferraz', displayName: 'Ricardo Ferraz', bio: 'Apreciador de cubanos há 15 anos. Robusto é vida.', city: 'São Paulo', state: 'SP', avatarSeed: 12, isPrivate: false, premium: true, ageYears: 42 },
  { username: 'carla.mendonca', displayName: 'Carla Mendonça', bio: 'Sommelière de whisky e charutos. Combinações são minha paixão.', city: 'Rio de Janeiro', state: 'RJ', avatarSeed: 47, isPrivate: false, premium: true, ageYears: 38 },
  { username: 'joao_charutista', displayName: 'João Pedro Alves', bio: 'Colecionador. Umidor sempre cheio, carteira sempre vazia.', city: 'Belo Horizonte', state: 'MG', avatarSeed: 33, isPrivate: false, premium: false, ageYears: 29 },
  { username: 'fernanda.tabaco', displayName: 'Fernanda Rocha', bio: 'Nicaraguenses > tudo. Discordem se tiverem coragem.', city: 'Curitiba', state: 'PR', avatarSeed: 45, isPrivate: false, premium: true, ageYears: 34 },
  { username: 'marcelo_habano', displayName: 'Marcelo Habano', bio: 'Fim de tarde sem charuto é dia perdido.', city: 'Porto Alegre', state: 'RS', avatarSeed: 22, isPrivate: false, premium: false, ageYears: 51 },
  { username: 'lu.dominicana', displayName: 'Luciana Prado', bio: 'Dominicanos suaves e um bom livro. É tudo que preciso.', city: 'São Paulo', state: 'SP', avatarSeed: 29, isPrivate: true, premium: false, ageYears: 27 },
  { username: 'bruno.charutaria', displayName: 'Bruno Salgado', bio: 'Trabalho com charutos, vivo de charutos, respiro charutos.', city: 'São Paulo', state: 'SP', avatarSeed: 51, isPrivate: false, premium: true, ageYears: 45 },
  { username: 'patricia_leaf', displayName: 'Patrícia Aguiar', bio: 'Iniciante curiosa. Aceito recomendações!', city: 'Florianópolis', state: 'SC', avatarSeed: 41, isPrivate: false, premium: false, ageYears: 25 },
  { username: 'diego.reserva', displayName: 'Diego Costa', bio: 'Reserva especial nos fins de semana, Robusto na semana.', city: 'Brasília', state: 'DF', avatarSeed: 15, isPrivate: false, premium: false, ageYears: 36 },
  { username: 'amanda.vitola', displayName: 'Amanda Vitola', bio: 'Fotografando cada charuto que fumo desde 2019.', city: 'Recife', state: 'PE', avatarSeed: 44, isPrivate: false, premium: true, ageYears: 31 },
  { username: 'gustavo.torcedor', displayName: 'Gustavo Lima', bio: 'Torcedor braguense de charuto torcido à mão.', city: 'Salvador', state: 'BA', avatarSeed: 18, isPrivate: false, premium: false, ageYears: 40 },
  { username: 'helena.puro', displayName: 'Helena Duarte', bio: 'Puro, sem pressa, sem pressão.', city: 'Rio de Janeiro', state: 'RJ', avatarSeed: 48, isPrivate: true, premium: false, ageYears: 55 },
  { username: 'thiago.anel', displayName: 'Thiago Anel de Fogo', bio: 'Anel de fumaça perfeito ou não vale a foto.', city: 'Campinas', state: 'SP', avatarSeed: 25, isPrivate: false, premium: false, ageYears: 33 },
  { username: 'renata.charuto', displayName: 'Renata Bezerra', bio: 'Charutos e negócios andam juntos na minha agenda.', city: 'São Paulo', state: 'SP', avatarSeed: 43, isPrivate: false, premium: true, ageYears: 47 },
];

interface ShopSeed {
  username: string;
  displayName: string;
  cnpjSuffix: string;
  tradeName: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  whatsapp: string;
  instagram: string;
  avgResponseSeconds: number;
  responseRate: number;
  greeting: string;
}

const SHOPS: ShopSeed[] = [
  {
    username: 'shop.tabacariareal',
    displayName: 'Tabacaria Real',
    cnpjSuffix: '0001',
    tradeName: 'Tabacaria Real',
    address: 'Rua Oscar Freire, 720 - Jardins, São Paulo - SP',
    city: 'São Paulo',
    lat: -23.5629,
    lng: -46.6704,
    whatsapp: '5511987654321',
    instagram: '@tabacariareal',
    avgResponseSeconds: 480,
    responseRate: 94,
    greeting: 'Olá! Bem-vindo à Tabacaria Real. Como podemos ajudar hoje?',
  },
  {
    username: 'shop.havanaloungesp',
    displayName: 'Havana Lounge SP',
    cnpjSuffix: '0002',
    tradeName: 'Havana Lounge SP',
    address: 'Av. Faria Lima, 1450 - Itaim Bibi, São Paulo - SP',
    city: 'São Paulo',
    lat: -23.5789,
    lng: -46.6842,
    whatsapp: '5511976543210',
    instagram: '@havanaloungesp',
    avgResponseSeconds: 900,
    responseRate: 87,
    greeting: 'Seja bem-vindo ao Havana Lounge! Temos uma seleção exclusiva de cubanos.',
  },
  {
    username: 'shop.casadofumofino',
    displayName: 'Casa do Fumo Fino',
    cnpjSuffix: '0003',
    tradeName: 'Casa do Fumo Fino',
    address: 'Rua Augusta, 2200 - Cerqueira César, São Paulo - SP',
    city: 'São Paulo',
    lat: -23.5558,
    lng: -46.6626,
    whatsapp: '5511965432109',
    instagram: '@casadofumofino',
    avgResponseSeconds: 1800,
    responseRate: 78,
    greeting: 'Oi! Consulte nosso estoque de charutos dominicanos e nicaraguenses.',
  },
  {
    username: 'shop.cigarboutiquejardins',
    displayName: 'Cigar Boutique Jardins',
    cnpjSuffix: '0004',
    tradeName: 'Cigar Boutique Jardins',
    address: 'Alameda Lorena, 800 - Jardins, São Paulo - SP',
    city: 'São Paulo',
    lat: -23.5665,
    lng: -46.6621,
    whatsapp: '5511954321098',
    instagram: '@cigarboutiquejardins',
    avgResponseSeconds: 360,
    responseRate: 96,
    greeting: 'Bem-vindo à Cigar Boutique! Atendimento personalizado para colecionadores.',
  },
  {
    username: 'shop.charutosecia.rj',
    displayName: 'Charutos & Cia RJ',
    cnpjSuffix: '0005',
    tradeName: 'Charutos & Cia',
    address: 'Rua Visconde de Pirajá, 550 - Ipanema, Rio de Janeiro - RJ',
    city: 'Rio de Janeiro',
    lat: -22.984,
    lng: -43.2047,
    whatsapp: '5521987654321',
    instagram: '@charutosecia.rj',
    avgResponseSeconds: 1200,
    responseRate: 82,
    greeting: 'Olá! Charutos & Cia à disposição, temos entrega no mesmo dia na Zona Sul.',
  },
  {
    username: 'shop.donhabanocwb',
    displayName: 'Don Habano Curitiba',
    cnpjSuffix: '0006',
    tradeName: 'Don Habano',
    address: 'Rua das Flores, 300 - Centro, Curitiba - PR',
    city: 'Curitiba',
    lat: -25.4296,
    lng: -49.2719,
    whatsapp: '5541987654321',
    instagram: '@donhabanocwb',
    avgResponseSeconds: 2400,
    responseRate: 70,
    greeting: 'Fala! Aqui é o Don Habano. Manda sua dúvida que respondemos rapidinho.',
  },
];

const REVIEW_COMMENTS = [
  'Queima impecável do início ao fim, sem precisar de retoque.',
  'Começou suave e ganhou corpo no segundo terço, adorei a evolução.',
  'Tiragem um pouco apertada, mas o sabor compensou.',
  'Combinou perfeitamente com um whisky de turfa. Recomendo.',
  'Não é o meu favorito da linha, mas ainda assim muito bom.',
  'Um dos melhores que já fumei este ano. Vale cada centavo.',
  'Cinza branca e firme, sinal de fumo de qualidade.',
  'Notas de couro e café bem marcantes no último terço.',
  'Fumei num fim de tarde tranquilo, experiência perfeita.',
  'Compraria uma caixa fechada sem pensar duas vezes.',
  'Achei um pouco forte para o meu gosto, mas bem construído.',
  'Equilíbrio excelente entre doçura e especiarias.',
  'Precisa de pelo menos 6 meses de descanso no umidor antes de fumar.',
  'Retrogosto longo e agradável, ficou na boca por minutos.',
  'Comprei na Tabacaria Real, atendimento excelente também.',
];

const PAIRINGS = ['Whisky single malt', 'Rum añejo', 'Café expresso', 'Vinho do Porto', 'Cachaça envelhecida', null, null];

const POST_CAPTIONS = [
  'Fim de tarde perfeito com esse companheiro.',
  'Primeira vez fumando esse e já virou favorito.',
  'Sábado de umidor aberto e boas conversas.',
  'Depois de 8 meses de descanso, valeu a espera.',
  'Momento de relaxar depois de uma semana puxada.',
  'Compartilhando com os amigos essa descoberta.',
  'Aniversário de charuto: um ano que comecei nessa jornada.',
  'Testando uma combinação nova. O que acham?',
  'De volta à tabacaria favorita para reabastecer o umidor.',
  'Nada como uma boa fumada pra fechar o dia.',
  'Charuto guardado há 2 anos, hora de abrir.',
  'Recomendação de um amigo que não decepcionou.',
  'Café da manhã e charuto, ritual de domingo.',
  'Comemorando uma conquista com esse aqui.',
  'Novo achado na charutaria do bairro.',
];

const COMMENT_TEXTS = [
  'Excelente escolha! 🔥',
  'Também tenho esse no umidor, ainda não abri.',
  'Onde você encontrou? Procuro esse há tempos.',
  'Sabor incrível esse, concordo plenamente.',
  'Bora marcar uma fumada em grupo!',
  'Anotado pra próxima compra.',
  'Invejoso aqui, ainda não tive a chance de fumar esse.',
  'Combinação perfeita, já experimentei também.',
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function pickMany<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function daysAgo(days: number, hourJitter = 12) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(7, 22), randomInt(0, 59), 0, 0);
  return d;
}

async function ensureFakeUsers() {
  const created: { id: string; username: string; isPrivate: boolean; premium: boolean }[] = [];

  for (const seed of FAKE_USERS) {
    const email = `${seed.username}@${DEMO_EMAIL_DOMAIN}`;
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - seed.ageYears);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: null,
        username: seed.username,
        displayName: seed.displayName,
        bio: seed.bio,
        city: seed.city,
        state: seed.state,
        avatarUrl: avatar(seed.avatarSeed),
        birthDate,
        isPrivate: seed.isPrivate,
        accountType: 'PF',
        status: 'ACTIVE',
        subscriptionStatus: seed.premium ? 'ACTIVE' : 'NONE',
        trialStartedAt: seed.premium ? null : daysAgo(400),
        trialEndsAt: seed.premium ? null : daysAgo(393),
        lastSeenAt: daysAgo(randomInt(0, 5)),
      },
      update: {
        avatarUrl: avatar(seed.avatarSeed),
        bio: seed.bio,
      },
    });
    created.push({ id: user.id, username: user.username, isPrivate: seed.isPrivate, premium: seed.premium });
  }

  console.log(`Usuários demo: ${created.length} garantidos.`);
  return created;
}

async function ensureShopUsers() {
  const created: { userId: string; shopId: string; lat: number; lng: number }[] = [];

  for (const s of SHOPS) {
    const email = `${s.username}@${DEMO_EMAIL_DOMAIN}`;
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 35);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: null,
        username: s.username,
        displayName: s.displayName,
        bio: `Charutaria parceira · ${s.city}`,
        city: s.city,
        avatarUrl: avatar(60 + SHOPS.indexOf(s)),
        birthDate,
        isPrivate: false,
        accountType: 'PJ',
        status: 'ACTIVE',
      },
      update: {},
    });

    const cnpj = `11222333${s.cnpjSuffix}0${randomInt(1, 9)}`.slice(0, 14).padEnd(14, '0');

    const shop = await prisma.shop.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        cnpj,
        tradeName: s.tradeName,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        whatsapp: s.whatsapp,
        instagram: s.instagram,
        isVerified: true,
        plan: 'ACTIVE',
        hours: {
          seg: '10:00-20:00',
          ter: '10:00-20:00',
          qua: '10:00-20:00',
          qui: '10:00-20:00',
          sex: '10:00-21:00',
          sab: '10:00-18:00',
          dom: 'fechado',
        },
        greetingMessage: s.greeting,
        avgResponseSeconds: s.avgResponseSeconds,
        responseRate: s.responseRate,
      },
      update: {
        isVerified: true,
        lat: s.lat,
        lng: s.lng,
        avgResponseSeconds: s.avgResponseSeconds,
        responseRate: s.responseRate,
        greetingMessage: s.greeting,
      },
    });

    created.push({ userId: user.id, shopId: shop.id, lat: s.lat, lng: s.lng });
  }

  console.log(`Charutarias demo: ${created.length} garantidas (todas verificadas).`);
  return created;
}

async function seedShopReviews(shops: { shopId: string }[], reviewers: { id: string }[]) {
  let count = 0;
  for (const shop of shops) {
    const n = randomInt(2, 4);
    const chosenReviewers = pickMany(reviewers, n);
    for (const reviewer of chosenReviewers) {
      const existing = await prisma.shopReview.findFirst({ where: { shopId: shop.shopId, userId: reviewer.id } });
      if (existing) continue;
      await prisma.shopReview.create({
        data: {
          shopId: shop.shopId,
          userId: reviewer.id,
          rating: pick(['4.0', '4.5', '5.0', '3.5', '5.0']),
          body: pick([
            'Atendimento excelente, indico!',
            'Bom estoque e preço justo.',
            'Vendedores conhecem muito bem os produtos.',
            'Ambiente agradável para fumar no local.',
            'Entrega rápida e charutos bem conservados.',
          ]),
          createdAt: daysAgo(randomInt(5, 200)),
        },
      });
      count++;
    }
  }
  console.log(`Avaliações de charutarias: ${count} criadas.`);
}

async function seedReviews(users: { id: string }[]) {
  const cigars = await prisma.cigar.findMany({ where: { status: 'APPROVED' }, select: { id: true } });
  const flavorNotes = await prisma.flavorNote.findMany({ select: { id: true } });
  if (cigars.length === 0) {
    console.warn('Nenhum charuto no catálogo — rode o seed principal antes (npm run prisma:seed).');
    return;
  }

  let count = 0;
  for (const user of users) {
    const numReviews = randomInt(3, 9);
    const chosenCigars = pickMany(cigars, numReviews);
    for (let i = 0; i < chosenCigars.length; i++) {
      const cigar = chosenCigars[i];
      const reviewDate = daysAgo(randomInt(1, 180));
      const exists = await prisma.review.findFirst({
        where: { userId: user.id, cigarId: cigar.id },
      });
      if (exists) continue;

      const rating = pick(['3.0', '3.5', '4.0', '4.5', '5.0', '4.0', '4.5', '2.5']);
      const notes = pickMany(flavorNotes, randomInt(2, 4));

      await prisma.review.create({
        data: {
          userId: user.id,
          cigarId: cigar.id,
          rating,
          perceivedStrength: randomInt(1, 5),
          smokeMinutes: randomInt(30, 75),
          draw: randomInt(3, 5),
          burn: randomInt(3, 5),
          body: pick(REVIEW_COMMENTS),
          pairedWith: pick(PAIRINGS) ?? undefined,
          reviewDate,
          createdAt: reviewDate,
          flavorNotes: {
            create: notes.map((n) => ({ flavorNoteId: n.id })),
          },
        },
      });
      count++;
    }
  }
  console.log(`Avaliações: ${count} criadas.`);

  await prisma.$executeRaw`
    UPDATE cigars c
    SET rating_avg = COALESCE(sub.avg_rating, 0),
        rating_count = COALESCE(sub.cnt, 0)
    FROM (
      SELECT cigar_id, AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*) AS cnt
      FROM reviews
      WHERE deleted_at IS NULL
      GROUP BY cigar_id
    ) sub
    WHERE c.id = sub.cigar_id
  `;
  console.log('Rating agregado dos charutos recalculado a partir das avaliações reais.');
}

async function cleanupDemoPosts(userIds: string[]) {
  const oldPosts = await prisma.post.findMany({ where: { authorId: { in: userIds } }, select: { id: true } });
  const oldPostIds = oldPosts.map((p) => p.id);
  if (oldPostIds.length === 0) return;

  await prisma.comment.deleteMany({ where: { postId: { in: oldPostIds } } });
  await prisma.like.deleteMany({ where: { postId: { in: oldPostIds } } });
  await prisma.review.updateMany({ where: { postId: { in: oldPostIds } }, data: { postId: null } });
  await prisma.postMedia.deleteMany({ where: { postId: { in: oldPostIds } } });
  await prisma.post.deleteMany({ where: { id: { in: oldPostIds } } });
  console.log(`Limpeza: ${oldPostIds.length} posts demo antigos removidos antes de recriar (idempotência).`);
}

async function seedPosts(users: { id: string; isPrivate: boolean }[]) {
  const cigars = await prisma.cigar.findMany({ where: { status: 'APPROVED' }, select: { id: true } });
  if (cigars.length === 0) return [];

  await cleanupDemoPosts(users.map((u) => u.id));

  const createdPostIds: string[] = [];
  let photoIdx = 0;

  for (const user of users) {
    const numPosts = randomInt(1, 3);
    for (let i = 0; i < numPosts; i++) {
      const cigar = pick(cigars);
      const createdAt = daysAgo(randomInt(0, 60));
      const photoId = POST_PHOTO_IDS[photoIdx % POST_PHOTO_IDS.length];
      photoIdx++;

      const post = await prisma.post.create({
        data: {
          authorId: user.id,
          cigarId: cigar.id,
          body: pick(POST_CAPTIONS),
          visibility: user.isPrivate && Math.random() < 0.5 ? 'FRIENDS' : 'PUBLIC',
          createdAt,
          updatedAt: createdAt,
          media: {
            create: [
              {
                url: postPhoto(photoId, 900),
                thumbUrl: postPhoto(photoId, 400),
                width: 900,
                height: 900,
                position: 0,
              },
            ],
          },
        },
      });
      createdPostIds.push(post.id);
    }
  }

  console.log(`Posts: ${createdPostIds.length} criados.`);
  return createdPostIds;
}

async function seedEngagement(postIds: string[], users: { id: string }[]) {
  let likeCount = 0;
  let commentCount = 0;

  for (const postId of postIds) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post) continue;
    const eligibleLikers = users.filter((u) => u.id !== post.authorId);
    const likers = pickMany(eligibleLikers, randomInt(0, Math.min(8, eligibleLikers.length)));

    for (const liker of likers) {
      await prisma.like.upsert({
        where: { userId_postId: { userId: liker.id, postId } },
        create: { userId: liker.id, postId },
        update: {},
      });
      likeCount++;
    }

    if (Math.random() < 0.6) {
      const commenters = pickMany(eligibleLikers, randomInt(1, 3));
      for (const commenter of commenters) {
        await prisma.comment.create({
          data: { postId, authorId: commenter.id, body: pick(COMMENT_TEXTS) },
        });
        commentCount++;
      }
    }
  }

  await prisma.$executeRaw`
    UPDATE posts p
    SET like_count = COALESCE(l.cnt, 0)
    FROM (SELECT post_id, COUNT(*) AS cnt FROM likes GROUP BY post_id) l
    WHERE p.id = l.post_id
  `;
  await prisma.$executeRaw`
    UPDATE posts p
    SET comment_count = COALESCE(c.cnt, 0)
    FROM (SELECT post_id, COUNT(*) AS cnt FROM comments WHERE deleted_at IS NULL GROUP BY post_id) c
    WHERE p.id = c.post_id
  `;

  console.log(`Engajamento: ${likeCount} curtidas, ${commentCount} comentários.`);
}

async function seedFollows(users: { id: string; isPrivate: boolean }[]) {
  let created = 0;
  for (const follower of users) {
    const numFollowing = randomInt(2, 6);
    const candidates = users.filter((u) => u.id !== follower.id);
    const followees = pickMany(candidates, numFollowing);
    for (const followee of followees) {
      const status = followee.isPrivate ? pick(['ACCEPTED', 'ACCEPTED', 'PENDING']) : 'ACCEPTED';
      const existing = await prisma.follow.findUnique({
        where: { followerId_followeeId: { followerId: follower.id, followeeId: followee.id } },
      });
      if (existing) continue;
      await prisma.follow.create({
        data: {
          followerId: follower.id,
          followeeId: followee.id,
          status,
          createdAt: daysAgo(randomInt(1, 300)),
        },
      });
      created++;
    }
  }

  await prisma.$executeRaw`
    UPDATE users u
    SET follower_count = COALESCE(fo.cnt, 0)
    FROM (SELECT followee_id, COUNT(*) AS cnt FROM follows WHERE status = 'ACCEPTED' GROUP BY followee_id) fo
    WHERE u.id = fo.followee_id
  `;
  await prisma.$executeRaw`
    UPDATE users u
    SET following_count = COALESCE(fi.cnt, 0)
    FROM (SELECT follower_id, COUNT(*) AS cnt FROM follows WHERE status = 'ACCEPTED' GROUP BY follower_id) fi
    WHERE u.id = fi.follower_id
  `;
  await prisma.$executeRaw`
    UPDATE users u
    SET friend_count = COALESCE(f.cnt, 0)
    FROM (
      SELECT a.follower_id AS user_id, COUNT(*) AS cnt
      FROM follows a
      JOIN follows b ON a.follower_id = b.followee_id AND a.followee_id = b.follower_id
      WHERE a.status = 'ACCEPTED' AND b.status = 'ACCEPTED'
      GROUP BY a.follower_id
    ) f
    WHERE u.id = f.user_id
  `;

  console.log(`Follows: ${created} relações criadas. Contadores recalculados.`);
}

async function connectDemoAccount(fakeUsers: { id: string; username: string }[]) {
  const demo = await prisma.user.findFirst({
    where: { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } }, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!demo) {
    console.log('Nenhuma conta real encontrada ainda — pulei a etapa de conectar a conta demo a usuários fictícios.');
    return;
  }

  const followers = pickMany(fakeUsers, Math.min(6, fakeUsers.length));
  let notifCount = 0;
  for (const follower of followers) {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: follower.id, followeeId: demo.id } },
    });
    if (existing) continue;
    await prisma.follow.create({
      data: { followerId: follower.id, followeeId: demo.id, status: 'ACCEPTED', createdAt: daysAgo(randomInt(0, 20)) },
    });
    await prisma.notification.create({
      data: {
        userId: demo.id,
        type: 'FOLLOW_ACCEPTED',
        actorId: follower.id,
        entityType: 'user',
        entityId: follower.id,
        createdAt: daysAgo(randomInt(0, 20)),
      },
    });
    notifCount++;
  }

  const following = pickMany(fakeUsers, Math.min(4, fakeUsers.length));
  for (const followee of following) {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: demo.id, followeeId: followee.id } },
    });
    if (existing) continue;
    await prisma.follow.create({
      data: { followerId: demo.id, followeeId: followee.id, status: 'ACCEPTED', createdAt: daysAgo(randomInt(0, 20)) },
    });
  }

  await prisma.$executeRaw`
    UPDATE users u
    SET follower_count = COALESCE(fo.cnt, 0)
    FROM (SELECT followee_id, COUNT(*) AS cnt FROM follows WHERE status = 'ACCEPTED' GROUP BY followee_id) fo
    WHERE u.id = fo.followee_id
  `;
  await prisma.$executeRaw`
    UPDATE users u
    SET following_count = COALESCE(fi.cnt, 0)
    FROM (SELECT follower_id, COUNT(*) AS cnt FROM follows WHERE status = 'ACCEPTED' GROUP BY follower_id) fi
    WHERE u.id = fi.follower_id
  `;

  console.log(`Conta demo (${demo.username}) conectada: ${followers.length} seguidores novos, ${following.length} seguindo novos, ${notifCount} notificações.`);
}

async function main() {
  console.log('Iniciando seed de demonstração (Vitola Hub)...');

  const fakeUsers = await ensureFakeUsers();
  const shops = await ensureShopUsers();

  await seedReviews(fakeUsers);
  const postIds = await seedPosts(fakeUsers);
  await seedEngagement(postIds, fakeUsers);
  await seedFollows(fakeUsers);
  await seedShopReviews(shops, fakeUsers);
  await connectDemoAccount(fakeUsers);

  console.log('Seed de demonstração concluído. O app agora deve parecer "vivo".');
}

main()
  .catch((err) => {
    console.error('Seed demo falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
