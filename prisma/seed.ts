// Seed do catálogo (seção 5.3): popula marcas e charutos reais/conhecidos
// (cubanos, nicaraguenses, dominicanos, hondurenhos) já como `APPROVED`, mais
// as notas de sabor comuns usadas nas avaliações estruturadas.
//
// Idempotente: roda com `npm run prisma:seed` (raiz) ou `npm run seed`
// (apps/api) quantas vezes for preciso sem duplicar nada —
// `Brand.name` é @unique (upsert direto); `Cigar` não tem unique composto no
// schema, então localizamos por (brandId, name, line) antes de criar.
import { PrismaClient } from '@prisma/client';
import { seedAchievements } from './seed-achievements';

const prisma = new PrismaClient();

interface FlavorNoteSeed {
  name: string;
  category: string;
}

const FLAVOR_NOTES: FlavorNoteSeed[] = [
  { name: 'Couro', category: 'terroso' },
  { name: 'Madeira', category: 'terroso' },
  { name: 'Cacau', category: 'doce' },
  { name: 'Café', category: 'torrado' },
  { name: 'Pimenta preta', category: 'especiarias' },
  { name: 'Pimenta branca', category: 'especiarias' },
  { name: 'Baunilha', category: 'doce' },
  { name: 'Terra', category: 'terroso' },
  { name: 'Feno', category: 'terroso' },
  { name: 'Mel', category: 'doce' },
  { name: 'Nozes', category: 'oleaginosas' },
  { name: 'Especiarias', category: 'especiarias' },
  { name: 'Cedro', category: 'madeira' },
  { name: 'Chocolate amargo', category: 'doce' },
  { name: 'Canela', category: 'especiarias' },
  { name: 'Caramelo', category: 'doce' },
  { name: 'Tabaco doce', category: 'tabaco' },
  { name: 'Frutas secas', category: 'frutado' },
  { name: 'Amêndoa', category: 'oleaginosas' },
  { name: 'Noz-moscada', category: 'especiarias' },
  { name: 'Cravo', category: 'especiarias' },
  { name: 'Grãos torrados', category: 'torrado' },
  { name: 'Pão tostado', category: 'torrado' },
  { name: 'Cereja', category: 'frutado' },
  { name: 'Ameixa seca', category: 'frutado' },
  { name: 'Alcaçuz', category: 'doce' },
  { name: 'Musgo', category: 'terroso' },
  { name: 'Couro curtido', category: 'terroso' },
  { name: 'Chá preto', category: 'torrado' },
  { name: 'Amendoim', category: 'oleaginosas' },
];

// Vitolas plausíveis (medidas reais aproximadas do mercado), usadas em
// rotação para as linhas de cada marca.
const VITOLA_TEMPLATES = [
  { vitola: 'Robusto', lengthMm: 124, ringGauge: 50, avgSmokeMinutes: 45 },
  { vitola: 'Toro', lengthMm: 152, ringGauge: 52, avgSmokeMinutes: 60 },
  { vitola: 'Churchill', lengthMm: 178, ringGauge: 48, avgSmokeMinutes: 75 },
  { vitola: 'Corona', lengthMm: 142, ringGauge: 42, avgSmokeMinutes: 40 },
  { vitola: 'Petit Corona', lengthMm: 129, ringGauge: 42, avgSmokeMinutes: 30 },
  { vitola: 'Belicoso', lengthMm: 140, ringGauge: 52, avgSmokeMinutes: 50 },
  { vitola: 'Torpedo', lengthMm: 159, ringGauge: 52, avgSmokeMinutes: 65 },
];

interface BrandSeed {
  name: string;
  countryCode: string;
  wrapper: string;
  strength: number; // 1-5
  lines: string[];
}

const BRANDS: BrandSeed[] = [
  {
    name: 'Cohiba',
    countryCode: 'CU',
    wrapper: 'Cubano',
    strength: 4,
    lines: ['Robusto', 'Siglo II', 'Siglo IV', 'Siglo VI', 'Esplendidos', 'Behike 52', 'Piramides Extra'],
  },
  {
    name: 'Montecristo',
    countryCode: 'CU',
    wrapper: 'Cubano',
    strength: 3,
    lines: ['No. 1', 'No. 2', 'No. 4', 'No. 5', 'Especial', 'Edmundo', 'Petit Edmundo'],
  },
  {
    name: 'Romeo y Julieta',
    countryCode: 'CU',
    wrapper: 'Cubano',
    strength: 3,
    lines: ['Churchill', 'Wide Churchill', 'Short Churchill', 'Petit Julieta', 'Exhibición No. 4', 'Fabuloso No. 2', 'Habana Reserva'],
  },
  {
    name: 'Partagás',
    countryCode: 'CU',
    wrapper: 'Cubano',
    strength: 4,
    lines: ['Serie D No. 4', 'Serie D No. 5', 'Serie P No. 2', '8-9-8', 'Shorts', 'Lusitanias', 'Presidentes'],
  },
  {
    name: 'H. Upmann',
    countryCode: 'CU',
    wrapper: 'Cubano',
    strength: 3,
    lines: ['Half Corona', 'Coronas Minor', 'Magnum 46', 'Magnum 50', 'Sir Winston', 'Connoisseur No. 1', 'Epicure'],
  },
  {
    name: 'Hoyo de Monterrey',
    countryCode: 'CU',
    wrapper: 'Cubano',
    strength: 2,
    lines: ['Epicure No. 1', 'Epicure No. 2', 'Epicure Especial', 'Double Corona', 'Petit Robusto', 'Churchill', 'Coronations'],
  },
  {
    name: 'Padrón',
    countryCode: 'NI',
    wrapper: 'Nicaraguense',
    strength: 4,
    lines: ['1926 Serie No. 1', '1926 Serie No. 35', '1964 Anniversary Imperial', '1964 Anniversary Exclusivo', '3000', '2000', 'Londres'],
  },
  {
    name: 'My Father',
    countryCode: 'NI',
    wrapper: 'Habano Nicaraguense',
    strength: 4,
    lines: ['My Father No. 1', 'Le Bijou 1922', 'Flor de Orlando', 'La Opulencia', 'Don Pepin Garcia Blue Label', 'La Antigüedad', 'Cedros Especiales'],
  },
  {
    name: 'Oliva',
    countryCode: 'NI',
    wrapper: 'Sumatra',
    strength: 3,
    lines: ['Serie V', 'Serie V Melanio', 'Serie O', 'Master Blends 3', 'Connecticut Reserve', 'Nub Habano', 'Cain F'],
  },
  {
    name: 'Joya de Nicaragua',
    countryCode: 'NI',
    wrapper: 'Corojo Nicaraguense',
    strength: 4,
    lines: ['Antaño 1970', 'Antaño Dark Corojo', 'Antaño Gran Reserva', 'Joya Red', 'Joya Black', 'Cabinetta', 'Número Uno'],
  },
  {
    name: 'Arturo Fuente',
    countryCode: 'DO',
    wrapper: 'Camerunês',
    strength: 3,
    lines: ['Hemingway Short Story', 'Hemingway Classic', 'Hemingway Signature', 'Don Carlos No. 2', 'Don Carlos No. 3', 'Fuente Fuente OpusX', 'Chateau Fuente'],
  },
  {
    name: 'Davidoff',
    countryCode: 'DO',
    wrapper: 'Ecuador Connecticut',
    strength: 2,
    lines: ['Yamasá', 'Nicaragua Box-Pressed', 'Grand Cru No. 2', 'Millennium Blend Robusto', 'Signature 2000', 'Aniversario No. 2', 'Escurio'],
  },
  {
    name: 'La Flor Dominicana',
    countryCode: 'DO',
    wrapper: 'Ligero Dominicano',
    strength: 5,
    lines: ['Andalusian Bull', 'Double Ligero Chisel', 'Cameroon Corona Gorda', 'Air Bender', 'Ligero L-500', 'Coronado Especial', 'Reserva Especial'],
  },
  {
    name: 'Camacho',
    countryCode: 'HN',
    wrapper: 'Corojo Hondurenho',
    strength: 4,
    lines: ['Corojo', 'Triple Maduro', 'Connecticut', 'Nicaragua Barrel-Aged', 'Ecuador', 'Criollo', 'Powerband'],
  },
  {
    name: 'Rocky Patel',
    countryCode: 'HN',
    wrapper: 'Sun Grown',
    strength: 3,
    lines: ['Vintage 1990', 'Vintage 1992', 'The Edge Maduro', 'Decade', 'Sun Grown Maduro', '1961', 'Olde World Reserve Maduro'],
  },
];

async function seedFlavorNotes() {
  for (const note of FLAVOR_NOTES) {
    await prisma.flavorNote.upsert({
      where: { name: note.name },
      create: { name: note.name, category: note.category },
      update: { category: note.category },
    });
  }
  console.log(`Notas de sabor: ${FLAVOR_NOTES.length} garantidas.`);
}

async function seedCigars() {
  let created = 0;
  let skipped = 0;

  for (const brandSeed of BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { name: brandSeed.name },
      create: { name: brandSeed.name, countryCode: brandSeed.countryCode, manufacturer: brandSeed.name },
      update: { countryCode: brandSeed.countryCode },
    });

    for (let i = 0; i < brandSeed.lines.length; i++) {
      const line = brandSeed.lines[i];
      const template = VITOLA_TEMPLATES[i % VITOLA_TEMPLATES.length];
      const name = `${brandSeed.name} ${line}`;

      const existing = await prisma.cigar.findFirst({
        where: { brandId: brand.id, name, line },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.cigar.create({
        data: {
          brandId: brand.id,
          name,
          line,
          countryCode: brandSeed.countryCode,
          vitola: template.vitola,
          lengthMm: template.lengthMm,
          ringGauge: template.ringGauge,
          strength: brandSeed.strength,
          wrapper: brandSeed.wrapper,
          avgSmokeMinutes: template.avgSmokeMinutes,
          status: 'APPROVED',
          source: 'seed',
        },
      });
      created++;
    }
  }

  console.log(`Charutos: ${created} criados, ${skipped} já existiam (idempotente).`);
}

async function main() {
  console.log('Iniciando seed do catálogo...');
  await seedFlavorNotes();
  await seedCigars();
  await seedAchievements(prisma);
  console.log('Seed concluído.');
}

main()
  .catch((err) => {
    console.error('Seed falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
