// Lista local de notas de sabor usada como fallback enquanto não existe um
// endpoint de catálogo de flavor notes (o model Prisma `FlavorNote` existe,
// mas nenhuma rota de listagem foi encontrada em apps/api/src no momento
// desta implementação).
//
// Agrupadas por categoria (mesmas categorias usadas no seed do catálogo,
// `prisma/seed.ts`) para exibir a seleção de sabores como uma pequena "roda
// de sabores", no espírito dos apps de vinho/whisky de referência.
export const FALLBACK_FLAVOR_NOTES = [
  'Madeira',
  'Couro',
  'Café',
  'Cacau',
  'Pimenta',
  'Terra',
  'Baunilha',
  'Castanha',
  'Mel',
  'Especiarias',
  'Frutas secas',
  'Cedro',
  'Amêndoa',
  'Caramelo',
  'Feno',
] as const;

export interface FlavorCategoryGroup {
  category: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  notes: string[];
}

export const FLAVOR_NOTE_GROUPS: FlavorCategoryGroup[] = [
  { category: 'Doce', icon: 'ice-cream-outline', notes: ['Mel', 'Baunilha', 'Caramelo', 'Cacau'] },
  { category: 'Torrado', icon: 'cafe-outline', notes: ['Café'] },
  { category: 'Especiarias', icon: 'flame-outline', notes: ['Pimenta', 'Especiarias'] },
  { category: 'Madeira', icon: 'leaf-outline', notes: ['Madeira', 'Cedro'] },
  { category: 'Terroso', icon: 'earth-outline', notes: ['Couro', 'Terra', 'Feno'] },
  { category: 'Oleaginosas', icon: 'nutrition-outline', notes: ['Castanha', 'Amêndoa'] },
  { category: 'Frutado', icon: 'nutrition-outline', notes: ['Frutas secas'] },
];
