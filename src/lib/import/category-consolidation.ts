/**
 * Mapeia categorias do CSV Época (hierárquicas) para categorias da loja
 * com no mínimo MIN_PRODUCTS_PER_CATEGORY produtos.
 */

export const MIN_PRODUCTS_PER_CATEGORY = 10

export type StoreCategoryDef = {
  name: string
  slug: string
  googleSlug: string
  sortOrder: number
}

/** Categorias finais da loja (slugs estáveis para Google Shopping e home). */
export const STORE_CATEGORIES: StoreCategoryDef[] = [
  { name: 'Perfumes Femininos', slug: 'perfumes-femininos', googleSlug: 'perfumes-femininos', sortOrder: 1 },
  { name: 'Perfumes Masculinos', slug: 'perfumes-masculinos', googleSlug: 'perfumes-masculinos', sortOrder: 2 },
  { name: 'Perfumes', slug: 'perfumes', googleSlug: 'perfumes', sortOrder: 3 },
  { name: 'Dermocosméticos', slug: 'dermocosmeticos', googleSlug: 'dermocosmeticos', sortOrder: 4 },
  { name: 'Proteção Solar', slug: 'protecao-solar', googleSlug: 'protecao-solar', sortOrder: 5 },
  { name: 'Maquiagem', slug: 'maquiagem', googleSlug: 'maquiagem', sortOrder: 6 },
  { name: 'Cuidados Capilares', slug: 'cuidados-capilares', googleSlug: 'cuidados-capilares', sortOrder: 7 },
  { name: 'Mamãe e Bebê', slug: 'mamae-e-bebe', googleSlug: 'mamae-e-bebe', sortOrder: 8 },
]

const STORE_BY_SLUG = new Map(STORE_CATEGORIES.map((c) => [c.slug, c]))

const SUN_KEYWORDS = [
  'protetor solar',
  'cuidados com o sol',
  'proteção solar',
  'protecao solar',
]

const INFANT_KEYWORDS = [
  'infantil',
  'infantis',
  'bebê',
  'bebe',
  'mamãe',
  'mamae',
]

function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isSunCategory(path: string): boolean {
  const n = normalizePath(path)
  return SUN_KEYWORDS.some((k) => n.includes(k))
}

function isInfantCategory(path: string): boolean {
  const n = normalizePath(path)
  return INFANT_KEYWORDS.some((k) => n.includes(k))
}

/**
 * Resolve a categoria da loja a partir do caminho bruto do CSV
 * (ex.: "Perfumes, Perfume Feminino").
 */
export function resolveStoreCategorySlug(rawPath: string): string {
  const parts = rawPath.split(',').map((s) => s.trim()).filter(Boolean)
  const top = parts[0] ?? ''
  const sub = parts[1] ?? ''
  const full = parts.join(', ')

  if (isSunCategory(full)) return 'protecao-solar'
  if (isInfantCategory(full)) return 'mamae-e-bebe'

  if (top === 'Perfumes') {
    if (sub === 'Perfume Feminino') return 'perfumes-femininos'
    if (sub === 'Perfume Masculino') return 'perfumes-masculinos'
    return 'perfumes'
  }

  if (top === 'Homens') {
    if (sub === 'Perfumes' || sub === 'Desodorante Corporal') return 'perfumes-masculinos'
    if (sub === 'Cabelos') return 'cuidados-capilares'
    return 'perfumes-masculinos'
  }

  if (top === 'Maquiagem') return 'maquiagem'
  if (top === 'Cabelos') return 'cuidados-capilares'
  if (top === 'Dermocosméticos') return 'dermocosmeticos'
  if (top === 'Tratamentos') return 'dermocosmeticos'
  if (top === 'Cuidados Pessoais') {
    if (isInfantCategory(full)) return 'mamae-e-bebe'
    return 'dermocosmeticos'
  }
  if (top === 'Bem Estar') return 'dermocosmeticos'

  return 'dermocosmeticos'
}

export type CategoryAssignment = {
  slug: string
  name: string
  reason?: string
}

/**
 * Atribui categoria a um produto. Se a categoria primária ficar com menos de
 * MIN produtos após consolidação global, faz merge para categoria pai.
 */
export function assignProductCategory(
  rawPaths: string[],
  globalCounts: Map<string, number>
): CategoryAssignment {
  const slugVotes = new Map<string, number>()
  for (const path of rawPaths) {
    const slug = resolveStoreCategorySlug(path)
    slugVotes.set(slug, (slugVotes.get(slug) ?? 0) + 1)
  }

  let bestSlug = 'dermocosmeticos'
  let bestVotes = 0
  for (const [slug, votes] of slugVotes) {
    if (votes > bestVotes) {
      bestVotes = votes
      bestSlug = slug
    }
  }

  const count = globalCounts.get(bestSlug) ?? 0
  if (count >= MIN_PRODUCTS_PER_CATEGORY) {
    const cat = STORE_BY_SLUG.get(bestSlug)!
    return { slug: bestSlug, name: cat.name }
  }

  const fallback = consolidateSmallCategory(bestSlug, globalCounts)
  const cat = STORE_BY_SLUG.get(fallback.slug)!
  return {
    slug: fallback.slug,
    name: cat.name,
    reason: fallback.reason,
  }
}

type FallbackResult = { slug: string; reason: string }

function consolidateSmallCategory(
  slug: string,
  globalCounts: Map<string, number>
): FallbackResult {
  const mergeTargets: Record<string, string> = {
    'perfumes-femininos': 'perfumes',
    'perfumes-masculinos': 'perfumes',
    perfumes: 'dermocosmeticos',
    'mamae-e-bebe': 'dermocosmeticos',
    'protecao-solar': 'dermocosmeticos',
    maquiagem: 'dermocosmeticos',
    'cuidados-capilares': 'dermocosmeticos',
    dermocosmeticos: 'dermocosmeticos',
  }

  const chain = [slug]
  let current = slug
  while (true) {
    const next = mergeTargets[current]
    if (!next || next === current) break
    chain.push(next)
    current = next
  }

  for (const candidate of chain) {
    if ((globalCounts.get(candidate) ?? 0) >= MIN_PRODUCTS_PER_CATEGORY) {
      if (candidate !== slug) {
        return {
          slug: candidate,
          reason: `Categoria "${slug}" tinha apenas ${globalCounts.get(slug)} produtos; consolidada em "${candidate}".`,
        }
      }
      return { slug: candidate, reason: '' }
    }
  }

  const largest = [...globalCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (largest && largest[1] >= MIN_PRODUCTS_PER_CATEGORY) {
    return {
      slug: largest[0],
      reason: `Categoria "${slug}" abaixo do mínimo; produto movido para "${largest[0]}" (${largest[1]} produtos).`,
    }
  }

  return {
    slug: 'dermocosmeticos',
    reason: `Fallback para dermocosmeticos (categoria "${slug}" insuficiente).`,
  }
}

/** Primeira passagem: conta produtos por slug antes da consolidação. */
export function countPrimaryCategories(
  products: { rawCategoryPaths: string[] }[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const product of products) {
    const slugVotes = new Map<string, number>()
    for (const path of product.rawCategoryPaths) {
      const slug = resolveStoreCategorySlug(path)
      slugVotes.set(slug, (slugVotes.get(slug) ?? 0) + 1)
    }
    let bestSlug = 'dermocosmeticos'
    let bestVotes = 0
    for (const [slug, votes] of slugVotes) {
      if (votes > bestVotes) {
        bestVotes = votes
        bestSlug = slug
      }
    }
    counts.set(bestSlug, (counts.get(bestSlug) ?? 0) + 1)
  }
  return counts
}

export function getHomeCarouselSlugs(finalCounts: Map<string, number>): string[] {
  const eligible = STORE_CATEGORIES.filter(
    (c) => (finalCounts.get(c.slug) ?? 0) >= MIN_PRODUCTS_PER_CATEGORY
  )
    .sort((a, b) => (finalCounts.get(b.slug) ?? 0) - (finalCounts.get(a.slug) ?? 0))
    .slice(0, 5)
    .map((c) => c.slug)

  return eligible
}
