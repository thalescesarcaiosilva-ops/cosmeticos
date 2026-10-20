/**
 * Mapeamento das categorias internas da loja para a taxonomia oficial do
 * Google Shopping (taxonomy-with-ids.pt-BR.txt).
 *
 * Referência: https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt
 *
 * Regra do Google: envie o ID numérico OU o caminho completo da categoria,
 * nunca os dois (usamos apenas o ID numérico, que é a forma recomendada e
 * independente de idioma).
 */

type GoogleCategory = {
  id: number
  path: string
}

/** Categoria de fallback (Saúde e beleza) usada quando o produto não tem
 * nenhuma categoria interna correspondente na taxonomia. */
export const DEFAULT_GOOGLE_CATEGORY: GoogleCategory = {
  id: 469,
  path: 'Saúde e beleza',
}

/** slug da categoria interna (tabela `categories`) -> categoria do Google. */
const CATEGORY_SLUG_TO_GOOGLE: Record<string, GoogleCategory> = {
  'aparadores-e-laminas': {
    id: 528,
    path: 'Saúde e beleza > Cuidados pessoais > Barbearia e embelezamento',
  },
  'cuidados-capilares': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'cuidados-corporais': {
    id: 474,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Banho e corpo',
  },
  dermocosmeticos: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'hidratantes-e-banho': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'hidratantes-seruns-e-olhos': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'higiene-pessoal': {
    id: 2915,
    path: 'Saúde e beleza > Cuidados pessoais',
  },
  'limpeza-e-tonificacao': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'mamae-e-bebe': {
    id: 537,
    path: 'Infantil',
  },
  maquiagem: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  'protecao-solar': {
    id: 2844,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Bloqueadores solares',
  },
  'perfumes-femininos': {
    id: 479,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Perfume e colônia',
  },
  'perfumes-masculinos': {
    id: 479,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Perfume e colônia',
  },
  perfumes: {
    id: 479,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Perfume e colônia',
  },
  shampoo: {
    id: 543615,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos > Xampu e condicionador > Shampoos',
  },
  condicionador: {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'mascara-capilar': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'creme-capilar': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'oleo-capilar': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'serum-capilar': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'kit-capilar': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'acessorio-capilar': {
    id: 486,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos',
  },
  'limpeza-facial': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  serum: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  hidratante: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  creme: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'tratamento-facial': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  desodorante: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  olhos: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  labios: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  banho: {
    id: 474,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Banho e corpo',
  },
  unhas: {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'agua-termal': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'kit-dermocosmetico': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  base: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  batom: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  corretivo: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  gloss: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  'mascara-de-cilios': {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  primer: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  demaquilante: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  pinceis: {
    id: 477,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Maquiagem',
  },
  'protetor-facial': {
    id: 2844,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Bloqueadores solares',
  },
  'protetor-corporal': {
    id: 2844,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Bloqueadores solares',
  },
  'protetor-com-cor': {
    id: 2844,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Bloqueadores solares',
  },
  'protetor-stick': {
    id: 2844,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Bloqueadores solares',
  },
  'protetor-po': {
    id: 2844,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Bloqueadores solares',
  },
  'tratamentos-e-clareadores': {
    id: 567,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele',
  },
  'tratamentos-e-mascaras': {
    id: 6262,
    path: 'Saúde e beleza > Cuidados pessoais > Cosméticos > Cuidados com a pele > Máscaras e peelings faciais',
  },
}

export type ResolvedGoogleCategory = GoogleCategory & { matched: boolean }

/**
 * Resolve a categoria do Google Shopping a partir dos slugs de categorias
 * internas do produto. Usa a primeira categoria com correspondência na
 * taxonomia; se nenhuma corresponder, cai no fallback "Saúde e beleza".
 */
function categoryDepth(path: string): number {
  return path.split('>').length
}

export function resolveGoogleProductCategory(
  categorySlugs: Array<string | null | undefined>
): ResolvedGoogleCategory {
  let best: GoogleCategory | null = null
  let bestDepth = -1

  for (const slug of categorySlugs) {
    if (!slug) continue
    const match = CATEGORY_SLUG_TO_GOOGLE[slug]
    if (!match) continue
    const depth = categoryDepth(match.path)
    if (depth >= bestDepth) {
      best = match
      bestDepth = depth
    }
  }

  if (!best) return { ...DEFAULT_GOOGLE_CATEGORY, matched: false }
  return { ...best, matched: true }
}
