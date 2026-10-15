/**
 * Corrige produtos do CSV unificado:
 * - categorias (ex.: Probio BHA → Dermocosméticos, Lattafa → Perfumes Femininos)
 * - descrições duplicadas (short === desc)
 * - imagens do produto EXATO via GTIN/EAN na Época VTEX (sem reaproveitar de outro produto)
 *
 *   npx tsx --env-file=.env.local scripts/fix-imported-catalog.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'
import { parseCsv } from '../src/lib/csv/parse-csv'
import { downloadRemoteImage } from '../src/lib/import/product-image-import'
import { sourceFilenameFromUrl } from '../src/lib/import/image-source-policy'
import { syncProductRelations } from '../src/lib/products/queries'
import { slugify } from '../src/lib/products/format'

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

const ADMIN_USER_ID =
  process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'
const UNI_CSV = path.resolve('faltantes_unificado_woocommerce_20261014_085613.csv')
const FARM_CSV = path.resolve('todos os produtos farmácia.csv')

function rowValue(row: string[], header: string[], column: string): string {
  const index = header.indexOf(column)
  if (index < 0) return ''
  return row[index] ?? ''
}

function normalizeKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseImagesRaw(raw: string): string[] {
  if (!raw.trim()) return []
  // Woo flat: comma-separated URLs
  if (raw.includes('http') && !raw.includes(' ! alt')) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((u) => /^https?:\/\//i.test(u))
  }
  // Woo classic: url ! alt : ... | url
  return raw
    .split(/\s\|\s/)
    .map((seg) => seg.split(/\s!\s*alt\s*:/i)[0]?.trim() ?? '')
    .filter((u) => /^https?:\/\//i.test(u))
}

function mapCorrectCategory(name: string, rawCats: string[]): string {
  const blob = `${rawCats.join(' ')} ${name}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const isFralda =
    /\bfralda\b|\blenco\s+umedecido|\bmamypoko\b|\bhuggies\b|\bbabysec\b|\bpampers\b/.test(
      blob,
    ) || rawCats.some((c) => /fraldas|len[cç]os/i.test(c))
  if (isFralda) return 'Fraldas e Lenços Umedecidos'

  if (
    rawCats.some((c) => /mam[aã]e/i.test(c)) &&
    !isFralda &&
    /\bbebe\b|\bbaby\b|granado/.test(blob)
  ) {
    return 'Mamãe e Bebê'
  }

  // Perfumes primeiro (antes de maquiagem / solar)
  const isPerfume =
    /(perfume|eau de|parfum|toilette|\bedp\b|\bedt\b|colonia|lattafa|rasasi|alhambra|hawas|khamrah|ferrari|scuderia|rabanne|olympea|pure xs|sabrina carpenter|rue broca|nexa immortal|noble blush|bade.?al.?oud|como moiselle|perseus|sweet tooth)/.test(
      blob,
    ) && !/(hidratant|locao|body lotion|creme corporal)/.test(blob)

  if (isPerfume) {
    if (
      /(masculin|homme|\bman\b|asad|hawas|perseus|pure xs|immortal|ferrari|scuderia|black)/.test(
        blob,
      )
    ) {
      return 'Perfumes Masculinos'
    }
    return 'Perfumes Femininos'
  }

  // Maquiagem
  if (
    /(base liquida|batom|mascara de cilios|rimel|blush|corretivo|maquiagem|gloss|demaquilante|lip bunny|glossip)/.test(
      blob,
    ) ||
    rawCats.some((c) => /maquiag/i.test(c))
  ) {
    return 'Maquiagem'
  }

  // Capilar
  if (
    /(shampoo|condicionador|mascara capilar|cabelo|capilar|dercos|kerastase|oleo capilar|sensi-scalp)/.test(
      blob,
    ) ||
    rawCats.some((c) => /cuidados capilares/i.test(c))
  ) {
    return 'Cuidados Capilares'
  }

  // Proteção solar — só se for realmente protetor / FPS como produto principal
  // NÃO classificar sérum/creme facial só porque a categoria CSV misturou "Proteção Solar"
  const isRealSolar =
    /(protetor solar|fotoprotector|ideal soleil|uv-age|sun fresh|sun pigment|actine.*fps|hydrasoft fps)/.test(
      blob,
    ) ||
    (/\bfps\s*\d+/.test(blob) &&
      /(protetor|soleil|solar|uv)/.test(blob) &&
      !/(normaderm|probio|bha|liftactiv|neovadiol serum|mineral 89)/.test(blob))

  if (isRealSolar) return 'Proteção Solar'

  // Neovadiol com FPS no nome (creme uniformizador) → Dermocosméticos (cuidado facial, não linha solar)
  // User complaint: Probio BHA was wrongly in solar

  return 'Dermocosméticos'
}

function dedupeShortDescription(
  short: string | null,
  description: string | null,
): string | null {
  if (!short) return null
  if (!description) return short

  const s = short.trim()
  const d = description.trim()
  if (!s) return null

  // Mesmo texto ou short é prefixo/ellipsis da description
  const sNorm = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const dNorm = d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  if (sNorm === dNorm) return null
  if (dNorm.startsWith(sNorm.slice(0, Math.min(80, sNorm.length)))) return null
  if (sNorm.endsWith('...') && dNorm.startsWith(sNorm.replace(/\.\.\.$/, '').trim().slice(0, 60)))
    return null

  // Short muito longo e quase igual
  if (sNorm.length > 200 && dNorm.includes(sNorm.slice(0, 100))) return null

  return short
}

async function fetchEpocaImagesByGtin(gtin: string): Promise<string[]> {
  const url = `https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(gtin)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) return []
  const data = (await res.json()) as Array<{
    productName?: string
    items?: Array<{ images?: Array<{ imageUrl?: string }> }>
  }>
  if (!Array.isArray(data) || !data[0]) return []
  const imgs =
    data[0].items?.[0]?.images?.map((i) => i.imageUrl).filter(Boolean) ?? []
  return imgs as string[]
}

async function fetchEpocaImagesByName(name: string): Promise<string[]> {
  const q = encodeURIComponent(name.slice(0, 80))
  const url = `https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search/${q}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) return []
  const data = (await res.json()) as Array<{
    productName?: string
    items?: Array<{ images?: Array<{ imageUrl?: string }> }>
  }>
  if (!Array.isArray(data) || data.length === 0) return []

  const want = normalizeKey(name)
  const exact = data.find((p) => {
    const pn = normalizeKey(p.productName || '')
    return pn === want || pn.includes(want) || want.includes(pn)
  })
  const pick = exact ?? data[0]
  // Only accept if name similarity is high enough (exact product)
  const pn = normalizeKey(pick.productName || '')
  const tokens = want.split(' ').filter((t) => t.length > 2)
  const hit = tokens.filter((t) => pn.includes(t)).length
  if (tokens.length > 0 && hit / tokens.length < 0.6) return []

  return (
    (pick.items?.[0]?.images?.map((i) => i.imageUrl).filter(Boolean) as string[]) ??
    []
  )
}

async function importImage(
  admin: ReturnType<typeof createAdminClient>,
  sourceUrl: string,
  altText: string,
  productKey: string,
): Promise<string> {
  // Filename único por produto+url para NÃO reaproveitar mídia de outro produto
  const base = sourceFilenameFromUrl(sourceUrl).slice(0, 120)
  const filename = `${slugify(productKey).slice(0, 40)}-${base}`.slice(0, 255)

  const { data: existing } = await admin
    .from('media_assets')
    .select('id')
    .eq('filename', filename)
    .maybeSingle()
  if (existing) return existing.id

  const raw = await downloadRemoteImage(sourceUrl)
  const { uploadOptimizedMediaVariants } = await import('@/lib/media/upload-optimized')
  const uploaded = await uploadOptimizedMediaVariants({
    bucket: 'product-images',
    fileBuffer: raw,
    folder: 'import',
  })

  const { data, error } = await admin
    .from('media_assets')
    .insert({
      filename,
      storage_path: uploaded.storagePath,
      bucket: 'product-images',
      public_url: uploaded.publicUrl,
      thumb_url: uploaded.thumbUrl,
      medium_url: uploaded.mediumUrl,
      mime_type: uploaded.mimeType,
      size_bytes: uploaded.sizeBytes,
      alt_text: altText.slice(0, 255) || null,
      uploaded_by: ADMIN_USER_ID,
    })
    .select('id')
    .single()

  if (error || !data) {
    await admin.storage.from('product-images').remove(uploaded.pathsToCleanup)
    throw new Error(error?.message ?? 'Falha mídia')
  }
  return data.id
}

async function ensureCategoryId(
  admin: ReturnType<typeof createAdminClient>,
  name: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = name.toLowerCase()
  if (cache.has(key)) return cache.get(key)!
  const slug = slugify(name)
  const { data } = await admin
    .from('categories')
    .select('id, name')
    .or(`slug.eq.${slug},name.eq.${name}`)
    .maybeSingle()
  if (data) {
    cache.set(key, data.id)
    return data.id
  }
  const { data: created, error } = await admin
    .from('categories')
    .insert({ name, slug, active: true })
    .select('id')
    .single()
  if (error || !created) throw new Error(`Categoria ${name}: ${error?.message}`)
  cache.set(key, created.id)
  return created.id
}

type CsvProduct = {
  nome: string
  sku: string
  gtin: string
  cats: string[]
  images: string[]
  short: string
  description: string
}

function loadUnifiedCsv(): CsvProduct[] {
  const text = fs.readFileSync(UNI_CSV, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const header = rows[0]
  const out: CsvProduct[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const nome = rowValue(row, header, 'Nome').trim()
    if (!nome) continue
    out.push({
      nome,
      sku: rowValue(row, header, 'SKU').trim(),
      gtin: rowValue(row, header, 'GTIN, UPC, EAN, or ISBN').trim(),
      cats: rowValue(row, header, 'Categorias')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      images: parseImagesRaw(rowValue(row, header, 'Imagens')),
      short: rowValue(row, header, 'Descrição curta').trim(),
      description: rowValue(row, header, 'Descrição').trim(),
    })
  }
  return out
}

function loadFarmImagesBySku(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (!fs.existsSync(FARM_CSV)) return map
  const text = fs.readFileSync(FARM_CSV, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const header = rows[0]
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const sku = rowValue(row, header, 'sku').trim()
    const imgs = parseImagesRaw(rowValue(row, header, 'images'))
    if (sku && imgs.length) map.set(normalizeKey(sku), imgs)
  }
  return map
}

async function tryDownloadUrls(urls: string[]): Promise<string[]> {
  const ok: string[] = []
  for (const url of urls) {
    try {
      const host = new URL(url).hostname
      // Prefer hosts that work; skip known dead DNS
      if (/lopesfarma\.online|novaisimports\.com/i.test(host)) {
        // still try — may fail
      }
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 12000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      })
      clearTimeout(t)
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && ct.startsWith('image/')) ok.push(url)
    } catch {
      // skip
    }
  }
  return ok
}

async function main() {
  const admin = createAdminClient()
  const csvProducts = loadUnifiedCsv()
  const farmImgs = loadFarmImagesBySku()
  const catCache = new Map<string, string>()

  const skuSet = new Set(csvProducts.map((c) => normalizeKey(c.sku)).filter(Boolean))
  const gtinSet = new Set(csvProducts.map((c) => normalizeKey(c.gtin)).filter(Boolean))

  // Load store products that match imported CSV (by sku/gtin/name)
  const { data: allProducts } = await admin
    .from('products')
    .select('id, slug, name, sku, gtin, description, short_description, price, original_price')

  const matched: Array<{
    store: NonNullable<typeof allProducts>[number]
    csv: CsvProduct
  }> = []

  for (const csv of csvProducts) {
    const store = (allProducts ?? []).find((p) => {
      if (csv.sku && p.sku && normalizeKey(p.sku) === normalizeKey(csv.sku)) return true
      if (csv.gtin && p.gtin && normalizeKey(p.gtin) === normalizeKey(csv.gtin)) return true
      return normalizeKey(p.name) === normalizeKey(csv.nome)
    })
    if (store) matched.push({ store, csv })
  }

  console.log(`Produtos do CSV encontrados na loja: ${matched.length}/${csvProducts.length}`)

  const categoryChanges: { slug: string; from: string; to: string }[] = []
  const descFixed: string[] = []
  const promoCleared: string[] = []
  const imagesFixed: { slug: string; count: number; source: string }[] = []
  const imagesFailed: { slug: string; reason: string }[] = []

  for (const { store, csv } of matched) {
    // --- promo: preço menor ativo, sem original ---
    if (store.original_price != null) {
      await admin
        .from('products')
        .update({ original_price: null, updated_at: new Date().toISOString() })
        .eq('id', store.id)
      promoCleared.push(store.slug)
    }

    // --- categoria ---
    const targetCat = mapCorrectCategory(csv.nome, csv.cats)
    const { data: currentCats } = await admin
      .from('product_categories')
      .select('category_id, categories(name)')
      .eq('product_id', store.id)
    const currentNames = (currentCats ?? []).map(
      (r) => (r.categories as unknown as { name: string } | null)?.name ?? '',
    )
    if (!currentNames.includes(targetCat) || currentNames.length !== 1) {
      const catId = await ensureCategoryId(admin, targetCat, catCache)
      await admin.from('product_categories').delete().eq('product_id', store.id)
      await admin.from('product_categories').insert({
        product_id: store.id,
        category_id: catId,
      })
      await admin
        .from('products')
        .update({ category_id: catId, updated_at: new Date().toISOString() })
        .eq('id', store.id)
      categoryChanges.push({
        slug: store.slug,
        from: currentNames.join('|') || '(nenhuma)',
        to: targetCat,
      })
    }

    // --- descrição duplicada ---
    const newShort = dedupeShortDescription(
      store.short_description,
      store.description,
    )
    if (newShort !== store.short_description) {
      await admin
        .from('products')
        .update({
          short_description: newShort,
          updated_at: new Date().toISOString(),
        })
        .eq('id', store.id)
      descFixed.push(store.slug)
    }

    // --- imagens (só se zerado) ---
    const { count: imgCount } = await admin
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', store.id)

    if ((imgCount ?? 0) > 0) continue

    let source = ''
    let urls: string[] = []

    // 1) CSV unificado — hosts vivos
    const csvLive = await tryDownloadUrls(csv.images)
    if (csvLive.length) {
      urls = csvLive
      source = 'csv-unificado'
    }

    // 2) CSV farmácia original
    if (!urls.length && csv.sku) {
      const farm = farmImgs.get(normalizeKey(csv.sku)) ?? []
      const farmLive = await tryDownloadUrls(farm)
      if (farmLive.length) {
        urls = farmLive
        source = 'csv-farmacia'
      }
    }

    // 3) Época VTEX — mesmo GTIN (produto exato)
    if (!urls.length && csv.gtin) {
      try {
        const epoca = await fetchEpocaImagesByGtin(csv.gtin)
        const live = await tryDownloadUrls(epoca)
        if (live.length) {
          urls = live
          source = 'epoca-gtin'
        }
      } catch {
        // ignore
      }
    }

    // 4) Época por nome (com similaridade)
    if (!urls.length) {
      try {
        const epoca = await fetchEpocaImagesByName(csv.nome)
        const live = await tryDownloadUrls(epoca)
        if (live.length) {
          urls = live
          source = 'epoca-nome'
        }
      } catch {
        // ignore
      }
    }

    if (!urls.length) {
      imagesFailed.push({ slug: store.slug, reason: 'nenhuma URL do produto exato disponível' })
      continue
    }

    const mediaIds: string[] = []
    for (const url of urls.slice(0, 6)) {
      try {
        const id = await importImage(admin, url, store.name, store.slug)
        if (!mediaIds.includes(id)) mediaIds.push(id)
      } catch (e) {
        console.error(`  img fail ${store.slug}:`, e instanceof Error ? e.message : e)
      }
    }

    if (!mediaIds.length) {
      imagesFailed.push({ slug: store.slug, reason: 'download falhou' })
      continue
    }

    await syncProductRelations(store.id, undefined, mediaIds)
    imagesFixed.push({ slug: store.slug, count: mediaIds.length, source })
    console.log(`imagens OK ${store.slug}: ${mediaIds.length} via ${source}`)
  }

  // Verificações pontuais
  const checks = await Promise.all(
    [
      'normaderm-probio-bha-serum',
      'lattafa-bade-al-oud-noble-blush-100ml',
      'gloss-labial-fran-by-franciny-ehlke-lip-bunny',
    ].map(async (slug) => {
      const { data } = await admin
        .from('products')
        .select(
          'slug, price, original_price, short_description, description, product_images(id), product_categories(categories(name))',
        )
        .eq('slug', slug)
        .maybeSingle()
      if (!data) return { slug, missing: true }
      const short = (data.short_description || '').slice(0, 80)
      const desc = (data.description || '').slice(0, 80)
      return {
        slug,
        price: data.price,
        original: data.original_price,
        imgs: Array.isArray(data.product_images) ? data.product_images.length : 0,
        cats: data.product_categories,
        shortDescDup: short && desc && short === desc.slice(0, short.length),
      }
    }),
  )

  const summary = {
    matched: matched.length,
    promoCleared: promoCleared.length,
    categoryChanges,
    descFixed: descFixed.length,
    descFixedSample: descFixed.slice(0, 15),
    imagesFixed,
    imagesFailed,
    checks,
  }

  fs.writeFileSync(
    path.resolve('tmp-fix-imported-catalog.json'),
    JSON.stringify(summary, null, 2),
  )
  console.log('\n=== RESUMO ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
