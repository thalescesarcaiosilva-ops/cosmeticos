import { createAdminClient } from '../src/lib/supabase/admin'

type MediaRow = {
  id: string
  filename: string
  storage_path: string
  bucket: string
  created_at: string
}

type ProductImageRow = {
  id: string
  product_id: string
  media_id: string
  sort_order: number
}

async function main() {
  const admin = createAdminClient()

  const { data: media, error: mediaError } = await admin
    .from('media_assets')
    .select('id, filename, storage_path, bucket, created_at')
    .order('created_at', { ascending: true })

  if (mediaError) throw new Error(mediaError.message)

  const { data: productImages, error: piError } = await admin
    .from('product_images')
    .select('id, product_id, media_id, sort_order')

  if (piError) throw new Error(piError.message)

  const linksByMedia = new Map<string, ProductImageRow[]>()
  for (const link of productImages ?? []) {
    const list = linksByMedia.get(link.media_id) ?? []
    list.push(link)
    linksByMedia.set(link.media_id, list)
  }

  const byFilename = new Map<string, MediaRow[]>()
  for (const row of media ?? []) {
    const list = byFilename.get(row.filename) ?? []
    list.push(row)
    byFilename.set(row.filename, list)
  }

  const remap = new Map<string, string>()
  const deleteMediaIds = new Set<string>()

  for (const [, group] of byFilename) {
    if (group.length <= 1) continue

    const sorted = [...group].sort((a, b) => {
      const aLinks = linksByMedia.get(a.id)?.length ?? 0
      const bLinks = linksByMedia.get(b.id)?.length ?? 0
      if (bLinks !== aLinks) return bLinks - aLinks
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    const keeper = sorted[0]
    for (const duplicate of sorted.slice(1)) {
      remap.set(duplicate.id, keeper.id)
      deleteMediaIds.add(duplicate.id)
    }
  }

  let productImageUpdates = 0
  let productImageDeletes = 0

  for (const link of productImages ?? []) {
    const targetMediaId = remap.get(link.media_id)
    if (!targetMediaId || targetMediaId === link.media_id) continue

    const { data: existingTarget } = await admin
      .from('product_images')
      .select('id')
      .eq('product_id', link.product_id)
      .eq('media_id', targetMediaId)
      .maybeSingle()

    if (existingTarget) {
      const { error } = await admin.from('product_images').delete().eq('id', link.id)
      if (error) throw new Error(error.message)
      productImageDeletes++
      continue
    }

    const { error } = await admin
      .from('product_images')
      .update({ media_id: targetMediaId })
      .eq('id', link.id)

    if (error) throw new Error(error.message)
    productImageUpdates++
  }

  const { data: refreshedLinks, error: refreshError } = await admin
    .from('product_images')
    .select('id, product_id, media_id, sort_order')
    .order('sort_order', { ascending: true })

  if (refreshError) throw new Error(refreshError.message)

  const seenPerProduct = new Map<string, Set<string>>()
  for (const link of refreshedLinks ?? []) {
    const seen = seenPerProduct.get(link.product_id) ?? new Set<string>()
    if (seen.has(link.media_id)) {
      const { error } = await admin.from('product_images').delete().eq('id', link.id)
      if (error) throw new Error(error.message)
      productImageDeletes++
      continue
    }
    seen.add(link.media_id)
    seenPerProduct.set(link.product_id, seen)
  }

  const { data: linksAfterDedup } = await admin.from('product_images').select('media_id')
  const linkedMediaIds = new Set((linksAfterDedup ?? []).map((l) => l.media_id))

  for (const row of media ?? []) {
    if (linkedMediaIds.has(row.id)) continue
    deleteMediaIds.add(row.id)
  }

  const storagePaths: string[] = []
  for (const id of deleteMediaIds) {
    const row = (media ?? []).find((m) => m.id === id)
    if (!row) continue

    const { count } = await admin
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('media_id', id)

    if ((count ?? 0) > 0) continue

    storagePaths.push(row.storage_path)
    const { error } = await admin.from('media_assets').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await admin.storage.from('product-images').remove(storagePaths)
    if (storageError) {
      console.warn('Aviso ao remover arquivos do storage:', storageError.message)
    }
  }

  const { data: extraProducts } = await admin
    .from('products')
    .select('id, slug, woocommerce_id, name')
    .eq('active', true)

  console.log(
    JSON.stringify(
      {
        duplicateGroups: [...byFilename.values()].filter((g) => g.length > 1).length,
        remappedMedia: remap.size,
        productImageUpdates,
        productImageDeletes,
        deletedMedia: deleteMediaIds.size,
        deletedStorageFiles: storagePaths.length,
        activeProducts: extraProducts?.length ?? 0,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
