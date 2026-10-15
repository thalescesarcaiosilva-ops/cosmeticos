/**
 * Corrige pós-import:
 * 1) remove promoção (original_price = null), mantém price menor
 * 2) reimporta imagens dos produtos sem galeria
 * 3) move perfumes mal categorizados (ex. Ferrari) para Perfumes
 *
 *   npx tsx --env-file=.env.local scripts/fix-import-issues.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'
import { parseCsv } from '../src/lib/csv/parse-csv'
import { filterNonBlockedImages } from '../src/lib/import/image-source-policy'
import { downloadRemoteImage } from '../src/lib/import/product-image-import'
import { sourceFilenameFromUrl } from '../src/lib/import/image-source-policy'
import { syncProductRelations } from '../src/lib/products/queries'

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

function normalizeKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function importProductImage(
  admin: ReturnType<typeof createAdminClient>,
  sourceUrl: string,
  altText: string,
): Promise<string> {
  const filename = sourceFilenameFromUrl(sourceUrl).slice(0, 255)
  const { data: existing } = await admin
    .from('media_assets')
    .select('id')
    .eq('filename', filename)
    .order('created_at', { ascending: true })
    .limit(1)
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
    throw new Error(error?.message ?? 'Falha ao registrar mídia')
  }
  return data.id
}

async function main() {
  const admin = createAdminClient()

  // --- 1) Remover promoção dos importados recentes ---
  const { data: promoRows, error: promoErr } = await admin
    .from('products')
    .update({ original_price: null, updated_at: new Date().toISOString() })
    .gte('woocommerce_id', 2_200_000_000)
    .not('original_price', 'is', null)
    .select('id, slug, price')

  if (promoErr) throw promoErr
  console.log(`Promo removida (original_price=null): ${promoRows?.length ?? 0}`)

  // --- 2) Perfumes em Dermocosméticos → categoria correta ---
  const { data: perfumeCatM } = await admin
    .from('categories')
    .select('id, name')
    .eq('slug', 'perfumes-masculinos')
    .single()
  const { data: perfumeCatF } = await admin
    .from('categories')
    .select('id, name')
    .eq('slug', 'perfumes-femininos')
    .single()
  const { data: dermoCat } = await admin
    .from('categories')
    .select('id')
    .eq('slug', 'dermocosmeticos')
    .single()

  if (!perfumeCatM || !perfumeCatF || !dermoCat) {
    throw new Error('Categorias de perfume/dermo não encontradas')
  }

  const { data: dermoProducts } = await admin
    .from('product_categories')
    .select('product_id, products!inner(id, name, slug, active)')
    .eq('category_id', dermoCat.id)

  const perfumeMoves: { id: string; slug: string; name: string; to: string }[] = []
  for (const row of dermoProducts ?? []) {
    const p = row.products as unknown as {
      id: string
      name: string
      slug: string
      active: boolean
    }
    if (!p?.active) continue
    const blob = `${p.name} ${p.slug}`.toLowerCase()
    if (/sem\s+perfume|sem\s+fragr/.test(blob)) continue
    if (/(hidratant|locao|body\s+lotion|creme\s+corporal)/.test(blob) && !/(eau de|parfum|perfume)/.test(blob))
      continue

    // Evita desodorante/creme "Homme" e similares
    if (/(desodorante|antitranspirante|shampoo|condicionador|sabonete|protetor)/.test(blob))
      continue

    const isPerfume =
      /(ferrari|scuderia|lattafa|rasasi|alhambra|hawas|khamrah|\basad\b|eau de|parfum|toilette|colonia|1 million|invictus|sauvage|phantom|polo blue|ck one)/.test(
        blob,
      ) || /ferrari-black-scuderia/.test(p.slug)

    if (!isPerfume) continue

    const toFemale =
      /(femme|woman|lady|girl|feminino|pour elle|bloom|eclaire|blush)/.test(blob)
    perfumeMoves.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      to: toFemale ? perfumeCatF.id : perfumeCatM.id,
    })
  }

  for (const move of perfumeMoves) {
    await admin.from('product_categories').delete().eq('product_id', move.id)
    await admin.from('product_categories').insert({
      product_id: move.id,
      category_id: move.to,
    })
    await admin
      .from('products')
      .update({
        category_id: move.to,
        updated_at: new Date().toISOString(),
      })
      .eq('id', move.id)
  }
  console.log(
    `Perfumes reclassificados: ${perfumeMoves.length}`,
    perfumeMoves.map((m) => m.slug),
  )

  // --- 3) Reimportar imagens dos sem galeria ---
  const { data: noImg } = await admin
    .from('products')
    .select('id, slug, name, sku, gtin')
    .gte('woocommerce_id', 2_200_000_000)

  const needImages: { id: string; slug: string; name: string; sku: string | null; gtin: string | null }[] =
    []
  for (const p of noImg ?? []) {
    const { count } = await admin
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', p.id)
    if ((count ?? 0) === 0) {
      needImages.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        sku: p.sku,
        gtin: p.gtin,
      })
    }
  }
  console.log(`Produtos sem imagem: ${needImages.length}`)

  // Index CSV images by sku / gtin / normalized name
  const text = fs.readFileSync(UNI_CSV, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(text)
  const header = rows[0]
  type CsvImg = { nome: string; sku: string; gtin: string; images: { url: string; alt: string }[] }
  const csvItems: CsvImg[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const nome = rowValue(row, header, 'Nome').trim()
    if (!nome) continue
    csvItems.push({
      nome,
      sku: rowValue(row, header, 'SKU').trim(),
      gtin: rowValue(row, header, 'GTIN, UPC, EAN, or ISBN').trim(),
      images: parseImages(rowValue(row, header, 'Imagens')),
    })
  }

  function findCsvImages(p: {
    name: string
    sku: string | null
    gtin: string | null
  }): { url: string; alt: string }[] {
    if (p.sku) {
      const hit = csvItems.find((c) => normalizeKey(c.sku) === normalizeKey(p.sku!))
      if (hit?.images.length) return hit.images
    }
    if (p.gtin) {
      const hit = csvItems.find((c) => normalizeKey(c.gtin) === normalizeKey(p.gtin!))
      if (hit?.images.length) return hit.images
    }
    const nn = normalizeKey(p.name)
    const hit = csvItems.find((c) => normalizeKey(c.nome) === nn)
    return hit?.images ?? []
  }

  let imagesOk = 0
  let imagesFail = 0
  const imageErrors: { slug: string; message: string }[] = []

  for (const p of needImages) {
    const images = filterNonBlockedImages(findCsvImages(p))
    if (!images.length) {
      imagesFail++
      imageErrors.push({ slug: p.slug, message: 'Sem URLs no CSV' })
      continue
    }

    const mediaIds: string[] = []
    for (const img of images.slice(0, 8)) {
      try {
        const id = await importProductImage(admin, img.url, p.name)
        if (!mediaIds.includes(id)) mediaIds.push(id)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'erro'
        console.error(`  img fail ${p.slug}: ${message}`)
      }
    }

    if (mediaIds.length === 0) {
      imagesFail++
      imageErrors.push({ slug: p.slug, message: 'Todas as imagens falharam' })
      continue
    }

    await syncProductRelations(p.id, undefined, mediaIds)
    imagesOk++
    console.log(`  imagens OK ${p.slug}: ${mediaIds.length}`)
  }

  // Verify Lip Bunny + Ferrari
  const { data: lip } = await admin
    .from('products')
    .select(
      'slug, price, original_price, product_images(id), product_categories(categories(name))',
    )
    .eq('slug', 'gloss-labial-fran-by-franciny-ehlke-lip-bunny')
    .maybeSingle()
  const { data: ferrari } = await admin
    .from('products')
    .select(
      'slug, price, original_price, product_images(id), product_categories(categories(name))',
    )
    .eq('slug', 'ferrari-black-scuderia')
    .maybeSingle()

  const summary = {
    promoCleared: promoRows?.length ?? 0,
    perfumeMoves: perfumeMoves.map((m) => m.slug),
    imagesFixed: imagesOk,
    imagesFailed: imagesFail,
    imageErrors,
    lipBunny: lip
      ? {
          price: lip.price,
          original: lip.original_price,
          imgs: Array.isArray(lip.product_images) ? lip.product_images.length : 0,
          cats: lip.product_categories,
        }
      : null,
    ferrari: ferrari
      ? {
          price: ferrari.price,
          original: ferrari.original_price,
          imgs: Array.isArray(ferrari.product_images) ? ferrari.product_images.length : 0,
          cats: ferrari.product_categories,
        }
      : null,
  }

  fs.writeFileSync(
    path.resolve('tmp-fix-import-issues.json'),
    JSON.stringify(summary, null, 2),
  )
  console.log('\n=== Resultado ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
