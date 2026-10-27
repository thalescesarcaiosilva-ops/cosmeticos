/**
 * Importa o CSV de produtos ausentes (export PT da outra loja) para a Batista.
 *
 * - produtos ativos, estoque 200
 * - imagens baixadas e reenviadas ao Supabase desta loja
 * - categorias só entre as que já existem (pai + filha)
 * - marca existente quando o nome bate, mesmo com palavras a mais; senão cria
 * - descrições sem menção a outras lojas
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/import-ausentes-batista.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/import-ausentes-batista.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseCsv } from '../src/lib/csv/parse-csv'
import { importWooCommerceBatch } from '../src/lib/import/run-woocommerce-import'
import type { WooCommerceProductRow } from '../src/lib/import/woocommerce-csv'
import { slugify } from '../src/lib/products/format'
import { DEFAULT_PRODUCT_STOCK } from '../src/lib/products/stock'
import { createAdminClient } from '../src/lib/supabase/admin'

const CSV_PATH =
  process.argv.find((arg) => arg.endsWith('.csv')) ??
  'd:/pitecosmeticos/woocommerce-produtos-ausentes-batista.csv'
const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 40
const CONCURRENCY = 8
const ADMIN_USER_ID =
  process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'
const MAX_IMAGES = 8

const COMPETITOR_RE =
  /pites?\s*cosm[eé]ticos|pitecosmeticos|drogaria|farm[aá]cia|drogasil|droga\s*raia|pague\s*menos|paguemenos|ultrafarma|[ée]poca\s*cosm[eé]ticos|epocacosmeticos|beleza\s*na\s*web|belezanaweb|panvel|karla\s*cosm[eé]ticos|karlacosmeticos|netfarma|drogao|americanas|mercado\s*livre|magalu|shopee|amazon\.com/gi

const STOP_BRAND_TOKENS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'the', 'and', 'from'])

const GENERIC_BRAND_TOKENS = new Set([
  'professional',
  'professionals',
  'professionnel',
  'paris',
  'cosmetics',
  'cosmetic',
  'cosmeticos',
  'cosmetico',
  'skincare',
  'care',
  'men',
  'man',
  'collection',
  'brasil',
  'brazil',
])

function significantBrandTokens(value: string): string[] {
  return brandTokens(value).filter((token) => !GENERIC_BRAND_TOKENS.has(token))
}

function sameBrandCore(a: string, b: string): boolean {
  const left = significantBrandTokens(a)
  const right = significantBrandTokens(b)
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false
  return left.every((token, index) => token === right[index])
}

type BrandRow = { id: string; name: string; slug: string }

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function brandTokens(value: string): string[] {
  return normalizeKey(value)
    .split(' ')
    .filter((token) => token && !STOP_BRAND_TOKENS.has(token))
}

function rowValue(row: string[], header: string[], ...columns: string[]): string {
  for (const column of columns) {
    const index = header.indexOf(column)
    if (index >= 0) return row[index] ?? ''
  }
  return ''
}

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(/\s/g, '').replace(',', '.').trim())
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseImages(raw: string, alt: string): { url: string; alt: string }[] {
  const urls = raw
    .split(/[,\|]/)
    .map((part) => part.trim())
    .filter((url) => /^https?:\/\//i.test(url))
  const unique = [...new Set(urls)].slice(0, MAX_IMAGES)
  return unique.map((url) => ({ url, alt }))
}

function sanitizeStoreMentions(text: string | null): string | null {
  if (!text) return null
  let cleaned = decodeHtmlEntities(text)
  cleaned = cleaned.replace(
    /https?:\/\/[^\s"'<>]*(pite|drogaria|farmacia|drogasil|ultrafarma|epocacosmeticos|belezanaweb|panvel|paguemenos|magalu|amazon|shopee|americanas)[^\s"'<>]*/gi,
    ''
  )
  cleaned = cleaned.replace(COMPETITOR_RE, '')
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ')
  cleaned = cleaned.replace(/(?:\s*<br\s*\/?\s*>\s*){3,}/gi, '<br><br>')
  cleaned = cleaned.trim()
  return cleaned || null
}

function syntheticWooId(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0
  }
  return 2_400_000_000 + (Math.abs(hash) % 500_000_000)
}

function tokensAreEdge(shorter: string[], longer: string[]): boolean {
  if (shorter.length < 2 || shorter.length >= longer.length) return false
  const head = longer.slice(0, shorter.length).every((token, index) => token === shorter[index])
  const tail = longer.slice(-shorter.length).every((token, index) => token === shorter[index])
  return head || tail
}

function matchExistingBrand(raw: string, brands: BrandRow[]): BrandRow | null {
  const norm = normalizeKey(raw)
  const exact = brands.find((brand) => normalizeKey(brand.name) === norm)
  if (exact) return exact

  const rawSignificant = significantBrandTokens(raw)
  const candidates = brands.filter((brand) => {
    if (sameBrandCore(raw, brand.name)) return true
    const existingSignificant = significantBrandTokens(brand.name)
    return (
      tokensAreEdge(rawSignificant, existingSignificant) ||
      tokensAreEdge(existingSignificant, rawSignificant)
    )
  })
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const coreA = sameBrandCore(raw, a.name) ? 0 : 1
    const coreB = sameBrandCore(raw, b.name) ? 0 : 1
    if (coreA !== coreB) return coreA - coreB
    return brandTokens(a.name).length - brandTokens(b.name).length
  })
  return candidates[0]
}

function mapCategorySlugs(rawCategories: string, productName: string): string[] {
  const blob = normalizeKey(`${rawCategories} ${productName}`)
  const slugs = new Set<string>()

  const add = (...values: string[]) => {
    for (const value of values) slugs.add(value)
  }

  if (/\b(fralda|fraldas)\b/.test(blob)) {
    add('fraldas-e-lencos-umedecidos', 'fraldas')
  } else if (/lenco|lencos umedecidos|lenco umedecido/.test(blob)) {
    add('fraldas-e-lencos-umedecidos', 'lencos-umedecidos')
  } else if (
    /protetor solar|protecao solar|\bfps\b|filtro solar|bronzead|pos sol|apos sol/.test(blob)
  ) {
    add('protecao-solar')
    if (/\bstick\b/.test(blob)) add('protetor-stick')
    else if (/com cor/.test(blob)) add('protetor-com-cor')
    else if (/\bpo\b/.test(blob) && /solar|fps|protetor/.test(blob)) add('protetor-po')
    else if (/corporal|\bcorpo\b/.test(blob) && !/facial|rosto|face/.test(blob)) add('protetor-corporal')
    else add('protetor-facial')
  } else if (/shampoo/.test(blob)) {
    add('cuidados-capilares', 'shampoo')
  } else if (/condicionador/.test(blob)) {
    add('cuidados-capilares', 'condicionador')
  } else if (/mascara/.test(blob) && /cabelo|capilar|cabelos/.test(blob) && !/cilio/.test(blob)) {
    add('cuidados-capilares', 'mascara-capilar')
  } else if (/\boleo\b/.test(blob) && /cabelo|capilar/.test(blob)) {
    add('cuidados-capilares', 'oleo-capilar')
  } else if (/serum/.test(blob) && /cabelo|capilar/.test(blob)) {
    add('cuidados-capilares', 'serum-capilar')
  } else if (/creme/.test(blob) && /cabelo|capilar/.test(blob)) {
    add('cuidados-capilares', 'creme-capilar')
  } else if (/leave in|finalizador|cabelo|capilar|antiqueda/.test(blob)) {
    add('cuidados-capilares')
  } else if (/unha|esmalte|acetona|removedor/.test(blob)) {
    add('dermocosmeticos', 'unhas')
  } else if (/mascara de cilio|cilios|rimel/.test(blob)) {
    add('maquiagem', 'mascara-de-cilios')
  } else if (/\bbatom\b/.test(blob)) {
    add('maquiagem', 'batom')
  } else if (/\bgloss\b/.test(blob)) {
    add('maquiagem', 'gloss')
  } else if (/\bcorretivo\b/.test(blob)) {
    add('maquiagem', 'corretivo')
  } else if (/\bbase\b/.test(blob) && /liquida|facial|mate|cobertura/.test(blob)) {
    add('maquiagem', 'base')
  } else if (/demaquilante/.test(blob)) {
    add('maquiagem', 'demaquilante')
  } else if (/\bprimer\b/.test(blob)) {
    add('maquiagem', 'primer')
  } else if (/pincel|pinceis/.test(blob)) {
    add('maquiagem', 'pinceis')
  } else if (/\bblush\b|iluminador|po compacto|sombra|delineador|lapis/.test(blob)) {
    add('maquiagem')
  } else if (/desodorante|antitranspirante/.test(blob)) {
    add('dermocosmeticos', 'desodorante')
  } else if (/agua termal|agua thermal/.test(blob)) {
    add('dermocosmeticos', 'agua-termal')
  } else if (/banho|sabonete/.test(blob) && !/facial|rosto/.test(blob)) {
    add('dermocosmeticos', 'banho')
  } else if (/limpeza|gel de limpeza|espuma de limpeza|agua micelar/.test(blob)) {
    add('dermocosmeticos', 'limpeza-facial')
  } else if (/serum/.test(blob)) {
    add('dermocosmeticos', 'serum')
  } else if (/hidratante|locao|loção/.test(blob) && /corpo|corporal/.test(blob)) {
    add('dermocosmeticos', 'hidratante', 'cuidados-corporais')
  } else if (/hidratante|locao/.test(blob)) {
    add('dermocosmeticos', 'hidratante')
  } else if (/creme/.test(blob) && /corpo|corporal/.test(blob)) {
    add('dermocosmeticos', 'creme', 'cuidados-corporais')
  } else if (/creme/.test(blob)) {
    add('dermocosmeticos', 'creme')
  } else if (/labio|labial|bocao/.test(blob)) {
    add('dermocosmeticos', 'labios')
  } else if (/olho|olhos|contorno dos olhos/.test(blob)) {
    add('dermocosmeticos', 'olhos')
  } else if (/corpo|corporal/.test(blob)) {
    add('dermocosmeticos', 'cuidados-corporais')
  } else if (/kit\b/.test(blob) && /cabelo|capilar|shampoo/.test(blob)) {
    add('cuidados-capilares', 'kit-capilar')
  } else if (/\bkit\b/.test(blob)) {
    add('dermocosmeticos', 'kit-dermocosmetico')
  } else {
    add('dermocosmeticos')
  }

  return [...slugs]
}

async function fetchAll<T>(
  admin: ReturnType<typeof createAdminClient>,
  table: 'products' | 'brands' | 'categories',
  columns: string
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < 1000) break
  }
  return all
}

function buildProducts(
  text: string,
  brands: BrandRow[],
  takenSlugs: Set<string>,
  takenSkus: Set<string>,
  takenNames: Set<string>,
  takenWooIds: Set<number>
) {
  const rows = parseCsv(text)
  const header = rows[0] ?? []
  const products: WooCommerceProductRow[] = []
  const skipped: { sku: string; name: string; reason: string }[] = []
  const brandsToCreate = new Map<string, number>()
  const brandMatches = new Map<string, string>()
  let competitorHits = 0

  const usedSlugs = new Set(takenSlugs)

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((cell) => !cell.trim())) continue

    const type = rowValue(row, header, 'Tipo', 'Type').trim().toLowerCase()
    if (type && type !== 'simple') continue

    const name = decodeHtmlEntities(rowValue(row, header, 'Nome', 'Name')).trim()
    if (!name) continue

    const sku = rowValue(row, header, 'SKU').trim()
    const gtinRaw = rowValue(
      row,
      header,
      'GTIN, UPC, EAN, or ISBN',
      'GTIN',
      'Meta: gtin'
    ).trim()
    const gtin = /^\d{8,14}$/.test(gtinRaw) ? gtinRaw : null
    const nameKey = normalizeKey(name)
    const skuKey = sku.toLowerCase()

    if ((skuKey && takenSkus.has(skuKey)) || takenNames.has(nameKey)) {
      skipped.push({ sku, name, reason: 'já existe na loja' })
      continue
    }

    const sale = parsePrice(rowValue(row, header, 'Preço promocional', 'Sale price'))
    const regular = parsePrice(rowValue(row, header, 'Preço', 'Regular price'))
    const price = sale && regular && sale < regular ? sale : (sale ?? regular)
    if (!price) {
      skipped.push({ sku, name, reason: 'sem preço' })
      continue
    }
    const originalPrice = sale && regular && sale < regular ? regular : null

    const rawCategories = rowValue(row, header, 'Categorias', 'Categories')
    const categorySlugs = mapCategorySlugs(rawCategories, name)
    const rawBrand = decodeHtmlEntities(rowValue(row, header, 'Brands', 'Brand')).trim()
    const matched = rawBrand ? matchExistingBrand(rawBrand, brands) : null
    const brandName = matched?.name ?? (rawBrand ? rawBrand.slice(0, 120) : null)
    if (rawBrand && matched && normalizeKey(matched.name) !== normalizeKey(rawBrand)) {
      brandMatches.set(rawBrand, matched.name)
    }
    if (rawBrand && !matched) {
      brandsToCreate.set(rawBrand, (brandsToCreate.get(rawBrand) ?? 0) + 1)
    }

    const shortRaw = rowValue(row, header, 'Descrição curta', 'Short description')
    const descRaw = rowValue(row, header, 'Descrição', 'Description')
    const mentionsStore = [shortRaw, descRaw].some((value) => {
      COMPETITOR_RE.lastIndex = 0
      return COMPETITOR_RE.test(value)
    })
    if (mentionsStore) competitorHits++

    const description = sanitizeStoreMentions(descRaw)
    const shortDescription = sanitizeStoreMentions(shortRaw)
    const images = parseImages(rowValue(row, header, 'Imagens', 'Images'), name)

    let slug = slugify(name).slice(0, 180)
    if (!slug) slug = slugify(sku || `produto-${i}`)
    if (usedSlugs.has(slug)) {
      const suffix = slugify(sku || String(i)).slice(0, 24)
      slug = `${slug}-${suffix}`.slice(0, 200)
    }
    if (usedSlugs.has(slug)) {
      skipped.push({ sku, name, reason: 'slug já usado' })
      continue
    }
    usedSlugs.add(slug)

    const key = sku || gtin || name
    let wooId = syntheticWooId(key)
    while (takenWooIds.has(wooId)) wooId += 1
    takenWooIds.add(wooId)

    products.push({
      wooId,
      name: name.slice(0, 200),
      slug,
      description,
      shortDescription,
      sku: sku || null,
      gtin,
      price,
      originalPrice,
      stock: DEFAULT_PRODUCT_STOCK,
      active: true,
      brandName,
      categoryNames: categorySlugs,
      categorySlugs,
      images,
      metaTitle: null,
      metaDescription: null,
      productType: 'simple',
      variationCount: 0,
    })
  }

  const pendingNames = [...brandsToCreate.keys()]
  const canonical = new Map<string, string>()
  for (const name of pendingNames) {
    const group = pendingNames.filter((other) => sameBrandCore(name, other))
    group.sort(
      (a, b) => brandTokens(a).length - brandTokens(b).length || a.localeCompare(b, 'pt')
    )
    canonical.set(name, group[0] ?? name)
  }
  const collapsedCreates = new Map<string, number>()
  for (const product of products) {
    if (!product.brandName) continue
    const next = canonical.get(product.brandName)
    if (next) product.brandName = next
  }
  for (const [name, count] of brandsToCreate) {
    const key = canonical.get(name) ?? name
    collapsedCreates.set(key, (collapsedCreates.get(key) ?? 0) + count)
  }

  return { products, skipped, brandsToCreate: collapsedCreates, brandMatches, competitorHits }
}

async function main() {
  const resolved = path.resolve(CSV_PATH)
  if (!fs.existsSync(resolved)) {
    console.error(`Arquivo não encontrado: ${resolved}`)
    process.exit(1)
  }

  const admin = createAdminClient()
  const [brandRows, categoryRows, productRows] = await Promise.all([
    fetchAll<BrandRow>(admin, 'brands', 'id, name, slug'),
    fetchAll<{ slug: string }>(admin, 'categories', 'slug'),
    fetchAll<{ id: string; slug: string; sku: string | null; name: string; woocommerce_id: number | null }>(
      admin,
      'products',
      'id, slug, sku, name, woocommerce_id'
    ),
  ])

  const withImages = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('product_images')
      .select('product_id')
      .order('product_id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const row of page) withImages.add(row.product_id as string)
    if (page.length < 1000) break
  }

  const alreadyDone = productRows.filter((product) => withImages.has(product.id))

  const validSlugs = new Set(categoryRows.map((category) => category.slug))
  const text = fs.readFileSync(resolved, 'utf8')
  const built = buildProducts(
    text,
    brandRows,
    new Set(alreadyDone.map((product) => product.slug)),
    new Set(
      alreadyDone
        .map((product) => product.sku?.trim().toLowerCase())
        .filter((sku): sku is string => Boolean(sku))
    ),
    new Set(alreadyDone.map((product) => normalizeKey(product.name))),
    new Set(
      alreadyDone
        .map((product) => product.woocommerce_id)
        .filter((id): id is number => id != null)
    )
  )

  for (const product of built.products) {
    product.categorySlugs = (product.categorySlugs ?? []).filter((slug) => validSlugs.has(slug))
    if (product.categorySlugs.length === 0) product.categorySlugs = ['dermocosmeticos']
    product.categoryNames = product.categorySlugs
  }

  const withoutImages = built.products.filter((product) => product.images.length === 0).length
  console.log(
    JSON.stringify(
      {
        csv: resolved,
        paraImportar: built.products.length,
        ignorados: built.skipped.length,
        semImagem: withoutImages,
        mencoesOutrasLojas: built.competitorHits,
        marcasNovas: [...built.brandsToCreate.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
        marcasAproveitadasComNomeDiferente: [...built.brandMatches.entries()].map(
          ([from, to]) => ({ from, to })
        ),
        ignoradosAmostra: built.skipped.slice(0, 15),
      },
      null,
      2
    )
  )

  if (DRY_RUN) return

  const aggregate = {
    created: 0,
    updated: 0,
    skipped: 0,
    brandsCreated: 0,
    imagesImported: 0,
    errors: [] as { slug: string; message: string }[],
  }

  for (let i = 0; i < built.products.length; i += BATCH_SIZE) {
    const batch = built.products.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const total = Math.ceil(built.products.length / BATCH_SIZE)
    console.log(`\nLote ${batchNum}/${total}`)
    const result = await importWooCommerceBatch(batch, {
      updateImages: true,
      adminUserId: ADMIN_USER_ID,
      reuseExistingMedia: true,
      createOnly: true,
      relaxImageHosts: true,
      concurrency: CONCURRENCY,
    })
    aggregate.created += result.created
    aggregate.updated += result.updated
    aggregate.skipped += result.skipped
    aggregate.brandsCreated += result.brandsCreated
    aggregate.imagesImported += result.imagesImported
    aggregate.errors.push(...result.errors)
    console.log(
      `  criados=${result.created} ignorados=${result.skipped} imagens=${result.imagesImported} erros=${result.errors.length}`
    )
    for (const error of result.errors) {
      console.error(`  ERRO ${error.slug}: ${error.message}`)
    }
  }

  console.log('\n=== Importação concluída ===')
  console.log(JSON.stringify(aggregate, null, 2))
  if (aggregate.errors.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
