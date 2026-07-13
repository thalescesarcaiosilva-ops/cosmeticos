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
  shampoo: {
    id: 543615,
    path: 'Saúde e beleza > Cuidados pessoais > Cuidados com os cabelos > Xampu e condicionador > Shampoos',
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
export function resolveGoogleProductCategory(
  categorySlugs: Array<string | null | undefined>
): ResolvedGoogleCategory {
  for (const slug of categorySlugs) {
    if (!slug) continue
    const match = CATEGORY_SLUG_TO_GOOGLE[slug]
    if (match) return { ...match, matched: true }
  }
  return { ...DEFAULT_GOOGLE_CATEGORY, matched: false }
}
