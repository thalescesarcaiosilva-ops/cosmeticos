import { createAdminClient } from '@/lib/supabase/admin'
import { downloadRemoteImage, optimizeProductImage } from '@/lib/import/product-image-import'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import type { WooCommerceProductRow } from '@/lib/import/woocommerce-csv'
import { syncProductRelations } from '@/lib/products/queries'
import { slugify } from '@/lib/products/format'

export type ImportBatchOptions = {
  updateImages: boolean
  adminUserId: string
}

export type ImportItemResult = {
  slug: string
  name: string
  action: 'created' | 'updated' | 'skipped'
  message?: string
}

export type ImportBatchResult = {
  created: number
  updated: number
  skipped: number
  categoriesCreated: number
  brandsCreated: number
  imagesImported: number
  items: ImportItemResult[]
  errors: { slug: string; message: string }[]
}

type CategoryRow = { id: string; name: string; slug: string }
type BrandRow = { id: string; name: string; slug: string }

export async function importWooCommerceBatch(
  rows: WooCommerceProductRow[],
  options: ImportBatchOptions
): Promise<ImportBatchResult> {
  const admin = createAdminClient()
  const result: ImportBatchResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    categoriesCreated: 0,
    brandsCreated: 0,
    imagesImported: 0,
    items: [],
    errors: [],
  }

  const [{ data: existingCategories }, { data: existingBrands }] = await Promise.all([
    admin.from('categories').select('id, name, slug'),
    admin.from('brands').select('id, name, slug'),
  ])

  const categoryBySlug = new Map(
    (existingCategories ?? []).map((c: CategoryRow) => [c.slug, c])
  )
  const categoryByName = new Map(
    (existingCategories ?? []).map((c: CategoryRow) => [c.name.toLowerCase(), c])
  )
  const brandBySlug = new Map((existingBrands ?? []).map((b: BrandRow) => [b.slug, b]))
  const brandByName = new Map(
    (existingBrands ?? []).map((b: BrandRow) => [b.name.toLowerCase(), b])
  )

  for (const row of rows) {
    try {
      const itemResult = await importSingleProduct(
        admin,
        row,
        options,
        categoryBySlug,
        categoryByName,
        brandBySlug,
        brandByName,
        result
      )
      result.items.push(itemResult)
      if (itemResult.action === 'created') result.created++
      else if (itemResult.action === 'updated') result.updated++
      else result.skipped++
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido'
      result.errors.push({ slug: row.slug, message })
      result.items.push({ slug: row.slug, name: row.name, action: 'skipped', message })
      result.skipped++
    }
  }

  return result
}

async function importSingleProduct(
  admin: ReturnType<typeof createAdminClient>,
  row: WooCommerceProductRow,
  options: ImportBatchOptions,
  categoryBySlug: Map<string, CategoryRow>,
  categoryByName: Map<string, CategoryRow>,
  brandBySlug: Map<string, BrandRow>,
  brandByName: Map<string, BrandRow>,
  batch: ImportBatchResult
): Promise<ImportItemResult> {
  const categoryIds: string[] = []
  for (const name of row.categoryNames) {
    const id = await ensureCategory(admin, name, categoryBySlug, categoryByName, batch)
    if (id) categoryIds.push(id)
  }

  let brandId: string | null = null
  if (row.brandName) {
    brandId = await ensureBrand(admin, row.brandName, brandBySlug, brandByName, batch)
  }

  const { data: byWooId } = await admin
    .from('products')
    .select('id, slug')
    .eq('woocommerce_id', row.wooId)
    .maybeSingle()

  const { data: bySlug } = byWooId
    ? { data: null }
    : await admin.from('products').select('id, slug').eq('slug', row.slug).maybeSingle()

  const existing = byWooId ?? bySlug
  const isNew = !existing

  const productPayload = {
    name: row.name,
    slug: row.slug,
    description: row.description,
    short_description: row.shortDescription,
    price: row.price,
    original_price: row.originalPrice,
    stock: row.stock,
    sku: row.sku,
    gtin: row.gtin,
    meta_title: row.metaTitle?.slice(0, 70) ?? null,
    meta_description: row.metaDescription?.slice(0, 160) ?? null,
    brand_id: brandId,
    active: row.active,
    woocommerce_id: row.wooId,
    updated_at: new Date().toISOString(),
  }

  let productId: string

  if (existing) {
    const { data, error } = await admin
      .from('products')
      .update(productPayload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Falha ao atualizar produto')
    productId = data.id
  } else {
    const { data, error } = await admin
      .from('products')
      .insert(productPayload)
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        const uniqueSlug = `${row.slug}-${row.wooId}`.slice(0, 200)
        const { data: retry, error: retryError } = await admin
          .from('products')
          .insert({ ...productPayload, slug: uniqueSlug })
          .select('id')
          .single()
        if (retryError || !retry) throw new Error('Falha ao criar produto (slug duplicado)')
        productId = retry.id
      } else {
        throw new Error(error?.message ?? 'Falha ao criar produto')
      }
    } else {
      productId = data.id
    }
  }

  await syncProductRelations(productId, categoryIds, undefined)

  let mediaIds: string[] | undefined

  if ((isNew || options.updateImages) && row.images.length > 0) {
    mediaIds = []
    for (let i = 0; i < row.images.length; i++) {
      const image = row.images[i]
      try {
        const mediaId = await importProductImage(admin, image.url, image.alt || row.name, options.adminUserId)
        mediaIds.push(mediaId)
        batch.imagesImported++
      } catch {
        // Continua importando produto mesmo se uma imagem falhar
      }
    }
    if (mediaIds.length > 0) {
      await syncProductRelations(productId, undefined, mediaIds)
    }
  }

  return {
    slug: row.slug,
    name: row.name,
    action: isNew ? 'created' : 'updated',
  }
}

async function ensureCategory(
  admin: ReturnType<typeof createAdminClient>,
  name: string,
  bySlug: Map<string, CategoryRow>,
  byName: Map<string, CategoryRow>,
  batch: ImportBatchResult
): Promise<string | null> {
  const trimmed = name.trim().slice(0, 100)
  if (!trimmed) return null

  const existing = byName.get(trimmed.toLowerCase())
  if (existing) return existing.id

  const slug = slugify(trimmed).slice(0, 100)
  const slugHit = bySlug.get(slug)
  if (slugHit) return slugHit.id

  const { data, error } = await admin
    .from('categories')
    .insert({ name: trimmed, slug, active: true })
    .select('id, name, slug')
    .single()

  if (error || !data) {
    const { data: retry } = await admin.from('categories').select('id, name, slug').eq('slug', slug).maybeSingle()
    if (retry) {
      bySlug.set(retry.slug, retry)
      byName.set(retry.name.toLowerCase(), retry)
      return retry.id
    }
    throw new Error(`Categoria "${trimmed}": ${error?.message ?? 'erro'}`)
  }

  bySlug.set(data.slug, data)
  byName.set(data.name.toLowerCase(), data)
  batch.categoriesCreated++
  return data.id
}

async function ensureBrand(
  admin: ReturnType<typeof createAdminClient>,
  name: string,
  bySlug: Map<string, BrandRow>,
  byName: Map<string, BrandRow>,
  batch: ImportBatchResult
): Promise<string | null> {
  const trimmed = name.trim().slice(0, 120)
  if (!trimmed) return null

  const existing = byName.get(trimmed.toLowerCase())
  if (existing) return existing.id

  const slug = slugify(trimmed).slice(0, 120)
  const slugHit = bySlug.get(slug)
  if (slugHit) return slugHit.id

  const { data, error } = await admin
    .from('brands')
    .insert({ name: trimmed, slug, active: true })
    .select('id, name, slug')
    .single()

  if (error || !data) {
    const { data: retry } = await admin.from('brands').select('id, name, slug').eq('slug', slug).maybeSingle()
    if (retry) {
      bySlug.set(retry.slug, retry)
      byName.set(retry.name.toLowerCase(), retry)
      return retry.id
    }
    return null
  }

  bySlug.set(data.slug, data)
  byName.set(data.name.toLowerCase(), data)
  batch.brandsCreated++
  return data.id
}

async function importProductImage(
  admin: ReturnType<typeof createAdminClient>,
  sourceUrl: string,
  altText: string,
  adminUserId: string
): Promise<string> {
  const raw = await downloadRemoteImage(sourceUrl)
  const optimized = await optimizeProductImage(raw)

  const storagePath = `import/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${optimized.extension}`

  const { error: uploadError } = await admin.storage
    .from('product-images')
    .upload(storagePath, optimized.buffer, {
      contentType: optimized.mimeType,
      upsert: false,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: urlData } = admin.storage.from('product-images').getPublicUrl(storagePath)
  const normalizedPublicUrl = toSiteMediaUrl(urlData.publicUrl) ?? urlData.publicUrl
  const filename = sourceUrl.split('/').pop()?.split('?')[0] ?? 'import.webp'

  const { data, error } = await admin
    .from('media_assets')
    .insert({
      filename: filename.slice(0, 255),
      storage_path: storagePath,
      bucket: 'product-images',
      public_url: normalizedPublicUrl,
      mime_type: optimized.mimeType,
      size_bytes: optimized.size,
      alt_text: altText.slice(0, 255) || null,
      uploaded_by: adminUserId,
    })
    .select('id')
    .single()

  if (error || !data) {
    await admin.storage.from('product-images').remove([storagePath])
    throw new Error(error?.message ?? 'Falha ao registrar mídia')
  }

  return data.id
}
