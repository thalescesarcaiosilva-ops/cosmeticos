/**
 * Importa faltantes_unificado_woocommerce_*.csv com:
 * - preço do CSV farmácia (produtos-faltantes-farmacia.csv) quando existir
 * - categorias mapeadas para as da loja (+ cria só Mamãe e Bebê / Fraldas)
 * - sem categoria "Kits em Promoção"
 * - limpeza de garantia / lojas concorrentes nas descrições
 * - createOnly, active=true
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/import-faltantes-unificado.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/import-faltantes-unificado.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'
import { importWooCommerceBatch } from '../src/lib/import/run-woocommerce-import'
import type { WooCommerceProductRow } from '../src/lib/import/woocommerce-csv'
import { parseCsv } from '../src/lib/csv/parse-csv'
import { slugify } from '../src/lib/products/format'
import { DEFAULT_PRODUCT_STOCK } from '../src/lib/products/stock'

function loadEnvLocal() {
  const envPath = path.resolve('.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 3
const ADMIN_USER_ID =
  process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'

const UNI_CSV = path.resolve('faltantes_unificado_woocommerce_20261014_085613.csv')
const FARM_CSV = path.resolve('produtos-faltantes-farmacia.csv')

const COMPETITOR_RE =
  /paguemenos|pague\s*menos|[ée]poca\s*cosm[eé]ticos|ultrafarma|belezanaweb|beleza\s*na\s*web|drogasil|droga\s*raia|panvel|karlacosmeticos|lopes\s*farma|lopesfarma|novais\s*imports|novaisimports|drogaria\s*sp|drogariasp|resyla|farm[aá]cia\s+online|loja\s+oficial(?!\s+batista)/gi

const WARRANTY_BLOCK_RE =
  /(?:^|<br\s*\/?>|\n)\s*(?:<[^>]+>\s*)*(?:garantia|pol[ií]tica\s+de\s+(?:troca|devoluc|reembolso)|trocas?\s+e\s+devoluc|prazo\s+de\s+troca|devolucao\s+gratuita|satisfacao\s+garantida|direito\s+de\s+arrependimento)[\s\S]*?(?=(?:<br\s*\/?>\s*){2}|<\/(?:p|div|li|section)>|$)/gi

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
}

function normalizeKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeProductName(s: string): string {
  let n = normalizeKey(s)
  n = n.replace(/\b(eau de parfum|eau de toilette|edp|edt|refil|refill)\b/g, ' ')
  n = n.replace(/\b\d+\s*(ml|g|kg|un|und|caps|comp|sache|saches|unidades)\b/g, ' ')
  return n.replace(/\s+/g, ' ').trim()
}

function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter((t) => t.length > 1))
  const tb = new Set(b.split(' ').filter((t) => t.length > 1))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

function parsePrice(value: string): number | null {
  const n = parseFloat(String(value || '').replace(',', '.').trim())
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function rowValue(row: string[], header: string[], column: string): string {
  const index = header.indexOf(column)
  if (index < 0) return ''
  return row[index] ?? ''
}

function parseImages(raw: string): { url: string; alt: string }[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url, alt: '' }))
}

function sanitizeText(text: string | null): string | null {
  if (!text) return null
  let cleaned = decodeHtmlEntities(text)

  cleaned = cleaned.replace(
    /https?:\/\/[^\s"'<>]*(paguemenos|ultrafarma|epocacosmeticos|belezanaweb|drogasil|panvel|lopesfarma|novaisimports|drogariasp|karlacosmeticos)[^\s"'<>]*/gi,
    '',
  )

  cleaned = cleaned.replace(WARRANTY_BLOCK_RE, ' ')

  cleaned = cleaned.replace(
    /[^.<]*(?:garantia\s+(?:de|vital[ií]cia|estendida|do\s+produto)|troca\s+(?:em\s+)?\d+\s*dias|devoluc[aã]o\s+(?:em\s+)?\d+\s*dias|sem\s+perguntas)[^.<]*(?:\.|$)/gi,
    ' ',
  )

  cleaned = cleaned.replace(COMPETITOR_RE, '')

  cleaned = cleaned.replace(/\bBatista\s+Cosm[eé]ticos\b/gi, 'Batista Cosméticos')

  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .replace(/(?:&nbsp;\s*){2,}/gi, ' ')
    .trim()

  return cleaned || null
}

function mapBrand(raw: string | null): string | null {
  if (!raw) return null
  const decoded = decodeHtmlEntities(raw).trim()
  return decoded ? decoded.slice(0, 120) : null
}

function syntheticWooId(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0
  }
  return 2_200_000_000 + Math.abs(hash)
}

function uniqueSlug(base: string, used: Set<string>, key: string): string {
  let slug = slugify(base).slice(0, 200)
  if (!used.has(slug)) {
    used.add(slug)
    return slug
  }
  const suffix = slugify(key).slice(-24) || String(syntheticWooId(key))
  const withKey = `${slug}-${suffix}`.slice(0, 200)
  used.add(withKey)
  return withKey
}

/** Categorias permitidas na importação (só cria Mamãe/Fraldas se ainda não existirem). */
function mapStoreCategories(rawCategories: string[], productName: string): string[] {
  const raw = rawCategories.map((c) => c.trim()).filter(Boolean)
  const blob = `${raw.join(' ')} ${productName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const out: string[] = []

  const isFralda =
    raw.some((c) => /fraldas|len[cç]os/i.test(c)) ||
    /\bfralda\b|\blen[cç]o\s+umedecido|\bmamypoko\b|\bhuggies\b|\bbabysec\b|\bpampers\b/.test(
      blob,
    )
  const isMamae =
    raw.some((c) => /mam[aã]e\s*e\s*beb[eê]/i.test(c)) ||
    isFralda ||
    /\bbebe\b|\bbaby\b/.test(blob)

  if (isFralda) {
    out.push('Fraldas e Lenços Umedecidos')
    return out
  }
  if (isMamae && !isFralda) {
    out.push('Mamãe e Bebê')
    return out
  }

  // Ignora Kits em Promoção / Novidades / Coleção como destino final — classifica pelo conteúdo
  if (
    /(protetor solar|fps\s*\d|protecao solar|ideal soleil|uv-age|fotoprotector|sun fresh)/.test(
      blob,
    ) ||
    raw.some((c) => /prote[cç][aã]o solar/i.test(c))
  ) {
    out.push('Proteção Solar')
    return out
  }

  if (
    /(shampoo|condicionador|mascara capilar|cabelo|capilar|dercos|kerastase|oleo capilar)/.test(
      blob,
    ) ||
    raw.some((c) => /cuidados capilares/i.test(c))
  ) {
    out.push('Cuidados Capilares')
    return out
  }

  if (
    /(base liquida|batom|mascara de cilios|rimel|blush|corretivo|maquiagem|gloss|demaquilante)/.test(
      blob,
    ) ||
    raw.some((c) => /maquiag/i.test(c))
  ) {
    out.push('Maquiagem')
    return out
  }

  // Loção / hidratante corporal (ex.: Alien Mugler) não é perfume
  if (
    /(locao|hidratant|body lotion|creme corporal|oleo de banho)/.test(blob) &&
    !/(eau de|perfume|edp\b|edt\b)/.test(blob)
  ) {
    out.push('Dermocosméticos')
    return out
  }

  if (/(perfume|eau de|edt\b|edp\b|colonia|lattafa|rasasi|alhambra|mugler|rabanne|sabrina carpenter|rue broca|hawas|khamrah)/.test(blob)) {
    if (/masculin|homem|\bman\b|asad|hawas|perseus|pure xs|immortal/.test(blob)) {
      out.push('Perfumes Masculinos')
      return out
    }
    out.push('Perfumes Femininos')
    return out
  }

  // Cuidados com a Pele, Beleza e Saúde, Higiene Pessoal, Kits, Novidades (não perfume) → Dermocosméticos
  out.push('Dermocosméticos')
  return out
}

type FarmPrice = {
  nome: string
  sku: string
  gtin: string
  preco: number
  precoRegular: number | null
  precoPromo: number | null
}

function loadFarmPrices(): FarmPrice[] {
  const text = fs.readFileSync(FARM_CSV, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const header = rows[0]
  const out: FarmPrice[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const nome = rowValue(row, header, 'nome').trim()
    if (!nome) continue
    const preco = parsePrice(rowValue(row, header, 'preco'))
    if (!preco) continue
    out.push({
      nome,
      sku: rowValue(row, header, 'sku').trim(),
      gtin: rowValue(row, header, 'gtin').trim(),
      preco,
      precoRegular: parsePrice(rowValue(row, header, 'preco_regular')),
      precoPromo: parsePrice(rowValue(row, header, 'preco_promocional')),
    })
  }
  return out
}

function findFarmPrice(item: { nome: string; sku: string; gtin: string }, farm: FarmPrice[]) {
  const sku = normalizeKey(item.sku)
  if (sku) {
    const hit = farm.find((f) => normalizeKey(f.sku) === sku)
    if (hit) return hit
  }
  const gtin = normalizeKey(item.gtin)
  if (gtin) {
    const hit = farm.find((f) => normalizeKey(f.gtin) === gtin)
    if (hit) return hit
  }
  const nn = normalizeProductName(item.nome)
  let best: FarmPrice | null = null
  let bestScore = 0
  for (const f of farm) {
    const pn = normalizeProductName(f.nome)
    if (pn === nn) return f
    const score = tokenSetRatio(nn, pn)
    if (score > bestScore) {
      bestScore = score
      best = f
    }
  }
  if (best && bestScore >= 0.85) return best
  return null
}

function prepareProducts(): {
  products: WooCommerceProductRow[]
  skippedAlready: { name: string; reason: string }[]
  priceSource: { farmacia: number; unificado: number }
  categoryCounts: Record<string, number>
  cleanedWarrantyOrStore: number
} {
  const farm = loadFarmPrices()
  const text = fs.readFileSync(UNI_CSV, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const header = rows[0]
  const usedSlugs = new Set<string>()
  const products: WooCommerceProductRow[] = []
  const skippedAlready: { name: string; reason: string }[] = []
  const priceSource = { farmacia: 0, unificado: 0 }
  const categoryCounts: Record<string, number> = {}
  let cleanedWarrantyOrStore = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const type = rowValue(row, header, 'Tipo').trim().toLowerCase() || 'simple'
    if (type !== 'simple') continue

    const name = decodeHtmlEntities(rowValue(row, header, 'Nome')).trim()
    if (!name) continue

    const sku = rowValue(row, header, 'SKU').trim()
    const gtin = rowValue(row, header, 'GTIN, UPC, EAN, or ISBN').trim()
    const images = parseImages(rowValue(row, header, 'Imagens'))
    const uniPrice =
      parsePrice(rowValue(row, header, 'Preço promocional')) ??
      parsePrice(rowValue(row, header, 'Preço'))
    if (!uniPrice) continue
    if (images.length < 1) continue

    const farmHit = findFarmPrice({ nome: name, sku, gtin }, farm)
    let price = uniPrice
    let originalPrice: number | null = null
    if (farmHit) {
      price = farmHit.preco
      originalPrice =
        farmHit.precoPromo &&
        farmHit.precoRegular &&
        farmHit.precoRegular > farmHit.precoPromo
          ? farmHit.precoRegular
          : farmHit.precoRegular && farmHit.precoRegular > farmHit.preco
            ? farmHit.precoRegular
            : null
      // Se farmácia for maior que unificado, usa o menor (pedido: valor abaixo)
      if (uniPrice < price) {
        price = uniPrice
        originalPrice = farmHit.precoRegular && farmHit.precoRegular > uniPrice
          ? farmHit.precoRegular
          : null
      }
      priceSource.farmacia++
    } else {
      priceSource.unificado++
    }

    const rawCategories = rowValue(row, header, 'Categorias')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c) => !/kits?\s+em\s+promo/i.test(c))

    const categoryNames = mapStoreCategories(rawCategories, name)
    for (const c of categoryNames) {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1
    }

    const rawShort = rowValue(row, header, 'Descrição curta').trim() || null
    const rawDesc = rowValue(row, header, 'Descrição').trim() || null
    const shortDescription = sanitizeText(rawShort)
    const description = sanitizeText(rawDesc)
    if (
      (rawShort && rawShort !== shortDescription) ||
      (rawDesc && rawDesc !== description)
    ) {
      cleanedWarrantyOrStore++
    }

    const brandName = mapBrand(rowValue(row, header, 'Brands').trim() || null)
    const key = gtin || sku || name
    const stockRaw = parseInt(rowValue(row, header, 'Estoque').trim(), 10)
    const stock =
      !Number.isNaN(stockRaw) && stockRaw > 0 ? stockRaw : DEFAULT_PRODUCT_STOCK

    products.push({
      wooId: syntheticWooId(key),
      name: name.slice(0, 200),
      slug: uniqueSlug(name, usedSlugs, key),
      description,
      shortDescription,
      sku: sku || null,
      gtin: gtin || null,
      price,
      originalPrice,
      stock,
      active: true,
      brandName,
      categoryNames,
      images,
      metaTitle: null,
      metaDescription: null,
      productType: 'simple',
      variationCount: 0,
    })
  }

  return {
    products,
    skippedAlready,
    priceSource,
    categoryCounts,
    cleanedWarrantyOrStore,
  }
}

async function main() {
  const prepared = prepareProducts()
  console.log('=== Preparação ===')
  console.log(`Produtos preparados: ${prepared.products.length}`)
  console.log(`Preço farmácia: ${prepared.priceSource.farmacia}`)
  console.log(`Preço só unificado: ${prepared.priceSource.unificado}`)
  console.log(`Textos limpos (loja/garantia): ${prepared.cleanedWarrantyOrStore}`)
  console.log('Categorias destino:', prepared.categoryCounts)

  const admin = createAdminClient()

  // Dedup contra loja (GTIN / SKU / nome)
  const { data: existing } = await admin
    .from('products')
    .select('id, name, slug, sku, gtin')
  const existingList = existing ?? []
  const gtinSet = new Set(
    existingList.map((p) => normalizeKey(String(p.gtin || ''))).filter(Boolean),
  )
  const skuSet = new Set(
    existingList.map((p) => normalizeKey(String(p.sku || ''))).filter(Boolean),
  )
  const storeNames = existingList.map((p) => ({
    nn: normalizeProductName(p.name),
    slug: p.slug,
  }))

  const toImport: WooCommerceProductRow[] = []
  const skipped: { name: string; reason: string }[] = []

  for (const p of prepared.products) {
    if (p.gtin && gtinSet.has(normalizeKey(p.gtin))) {
      skipped.push({ name: p.name, reason: `GTIN já existe` })
      continue
    }
    if (p.sku && skuSet.has(normalizeKey(p.sku))) {
      skipped.push({ name: p.name, reason: `SKU já existe` })
      continue
    }
    const nn = normalizeProductName(p.name)
    const fuzzy = storeNames.find(
      (s) => s.nn === nn || tokenSetRatio(nn, s.nn) >= 0.85,
    )
    if (fuzzy) {
      skipped.push({ name: p.name, reason: `Nome parecido com ${fuzzy.slug}` })
      continue
    }
    toImport.push(p)
  }

  console.log(`\nJá na loja (pulados): ${skipped.length}`)
  console.log(`A importar: ${toImport.length}`)
  if (skipped.length) {
    console.log(
      'Amostra pulados:',
      skipped.slice(0, 8).map((s) => `${s.name} (${s.reason})`),
    )
  }
  console.log(
    'Amostra import:',
    toImport.slice(0, 5).map((p) => ({
      name: p.name,
      price: p.price,
      original: p.originalPrice,
      cat: p.categoryNames,
      images: p.images.length,
      gtin: p.gtin,
    })),
  )

  fs.writeFileSync(
    path.resolve('tmp-import-faltantes-prepared.json'),
    JSON.stringify(
      {
        toImportCount: toImport.length,
        skipped,
        categoryCounts: prepared.categoryCounts,
        priceSource: prepared.priceSource,
        cleanedWarrantyOrStore: prepared.cleanedWarrantyOrStore,
        sample: toImport.slice(0, 10),
      },
      null,
      2,
    ),
  )

  if (DRY_RUN) {
    console.log('\n[dry-run] Nenhuma importação feita.')
    return
  }

  // Garante categorias novas antes (só as duas pedidas)
  for (const name of ['Mamãe e Bebê', 'Fraldas e Lenços Umedecidos']) {
    const slug = slugify(name)
    const { data: existingCat } = await admin
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existingCat) {
      const { error } = await admin
        .from('categories')
        .insert({ name, slug, active: true })
      if (error) console.error(`Falha criar categoria ${name}:`, error.message)
      else console.log(`Categoria criada: ${name}`)
    }
  }

  const aggregate = {
    created: 0,
    updated: 0,
    skipped: 0,
    categoriesCreated: 0,
    brandsCreated: 0,
    imagesImported: 0,
    errors: [] as { slug: string; message: string }[],
  }

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toImport.length / BATCH_SIZE)
    console.log(`\nLote ${batchNum}/${totalBatches} (${batch.length})...`)

    const result = await importWooCommerceBatch(batch, {
      updateImages: true,
      adminUserId: ADMIN_USER_ID,
      reuseExistingMedia: true,
      createOnly: true,
      relaxImageHosts: true,
    })

    aggregate.created += result.created
    aggregate.updated += result.updated
    aggregate.skipped += result.skipped
    aggregate.categoriesCreated += result.categoriesCreated
    aggregate.brandsCreated += result.brandsCreated
    aggregate.imagesImported += result.imagesImported
    aggregate.errors.push(...result.errors)

    console.log(
      `  criados=${result.created} ignorados=${result.skipped} imagens=${result.imagesImported} erros=${result.errors.length}`,
    )
    for (const err of result.errors) {
      console.error(`  ERRO ${err.slug}: ${err.message}`)
    }
  }

  const { count: activeCount } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  fs.writeFileSync(
    path.resolve('tmp-import-faltantes-result.json'),
    JSON.stringify({ aggregate, skipped, activeCount }, null, 2),
  )

  console.log('\n=== Importação concluída ===')
  console.log(JSON.stringify(aggregate, null, 2))
  console.log(`Produtos ativos agora: ${activeCount ?? '?'}`)

  if (aggregate.errors.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
