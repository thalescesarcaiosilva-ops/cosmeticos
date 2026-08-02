/**
 * Limpeza de catálogo (aprovada pelo usuário):
 * - Remove categoria "perfumes" + seus 28 produtos
 * - Em masc/fem e demais categorias: remove produtos com <150 avaliações Época
 * - Remove kit Real Techniques sem match
 * - Apaga imagens órfãs no Storage
 * - NÃO altera produtos mantidos (ids / public_url)
 *
 * Uso: node --env-file=.env.local scripts/cleanup-catalog-by-reviews.mjs
 * Flag: --dry-run (só reporta)
 */
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const DRY = process.argv.includes('--dry-run')
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const REAL_TECHNIQUES_ID = '6ff50410-9bc2-49ce-ab0c-bc2dbb365694'

async function chunked(ids, size, fn) {
  for (let i = 0; i < ids.length; i += size) {
    await fn(ids.slice(i, i + size))
  }
}

async function main() {
  const nonPerfume = JSON.parse(fs.readFileSync('tmp-epoca-reviews-audit.json', 'utf8'))
  const perfumeMf = JSON.parse(fs.readFileSync('tmp-perfume-mf-reviews.json', 'utf8'))

  const removeIds = new Set()

  for (const r of nonPerfume.removeLow) removeIds.add(r.id)
  for (const r of perfumeMf.removeLow) removeIds.add(r.id)
  for (const r of perfumeMf.summary.genericCategoryProducts) removeIds.add(r.id)
  removeIds.add(REAL_TECHNIQUES_ID)

  const ids = [...removeIds]
  console.log(
    JSON.stringify(
      {
        dryRun: DRY,
        project: url.replace('https://', '').split('.')[0],
        removeCount: ids.length,
        breakdown: {
          nonPerfumeLowReviews: nonPerfume.removeLow.length,
          perfumeMfLowReviews: perfumeMf.removeLow.length,
          perfumeGenericCategory: perfumeMf.summary.genericCategoryProducts.length,
          realTechniques: 1,
        },
        keepEstimate:
          1000 -
          ids.length /* approx if no overlap */,
      },
      null,
      2
    )
  )

  // Collect media linked to products being removed
  const mediaIds = new Set()
  const mediaMeta = []
  await chunked(ids, 150, async (chunk) => {
    const { data, error } = await sb
      .from('product_images')
      .select('media_id, product_id')
      .in('product_id', chunk)
    if (error) throw error
    for (const row of data || []) if (row.media_id) mediaIds.add(row.media_id)
  })

  // Keep media still used by products that remain
  const mediaList = [...mediaIds]
  const sharedKeep = new Set()
  await chunked(mediaList, 150, async (chunk) => {
    const { data, error } = await sb
      .from('product_images')
      .select('media_id, product_id')
      .in('media_id', chunk)
    if (error) throw error
    for (const row of data || []) {
      if (!removeIds.has(row.product_id)) sharedKeep.add(row.media_id)
    }
  })

  const mediaToDelete = mediaList.filter((id) => !sharedKeep.has(id))
  console.log({
    mediaLinked: mediaList.length,
    mediaSharedWithKept: sharedKeep.size,
    mediaToDelete: mediaToDelete.length,
  })

  if (DRY) {
    console.log('DRY RUN — nenhuma alteração.')
    return
  }

  // Child tables first
  const childTables = [
    'product_bundles',
    'product_favorites',
    'product_reviews',
    'product_variations',
    'product_views_daily',
    'product_images',
    'product_categories',
  ]

  for (const table of childTables) {
    await chunked(ids, 100, async (chunk) => {
      let q = sb.from(table).delete()
      if (table === 'product_bundles') {
        // primary or companion
        const { error: e1 } = await sb
          .from(table)
          .delete()
          .in('primary_product_id', chunk)
        if (e1) throw e1
        const { error: e2 } = await sb
          .from(table)
          .delete()
          .in('companion_product_id', chunk)
        if (e2) throw e2
        return
      }
      const col = table === 'product_views_daily' ? 'product_id' : 'product_id'
      // product_bundles handled above
      if (table === 'product_bundles') return
      const { error } = await sb.from(table).delete().in(col, chunk)
      if (error) {
        // table may not exist / column differ
        if (/does not exist|Could not find/i.test(error.message)) {
          console.warn('skip', table, error.message)
          return
        }
        throw error
      }
    })
    console.log('cleared', table)
  }

  // order_items: keep history — null product_id if column allows, else skip delete products that are referenced
  // Try delete products; if FK blocks, report
  let deletedProducts = 0
  await chunked(ids, 50, async (chunk) => {
    const { data, error } = await sb.from('products').delete().in('id', chunk).select('id')
    if (error) throw error
    deletedProducts += (data || []).length
  })
  console.log('deleted products', deletedProducts)

  // Delete category "perfumes"
  const { data: cat, error: catErr } = await sb
    .from('categories')
    .select('id, slug')
    .eq('slug', 'perfumes')
    .maybeSingle()
  if (catErr) throw catErr
  if (cat) {
    await sb.from('product_categories').delete().eq('category_id', cat.id)
    const { error: delCat } = await sb.from('categories').delete().eq('id', cat.id)
    if (delCat) throw delCat
    console.log('deleted category perfumes', cat.id)
  }

  // Menu items pointing to /colecoes/perfumes
  const { data: menus } = await sb
    .from('menu_items')
    .select('id, href, slug')
    .or('slug.eq.perfumes,href.ilike.%/colecoes/perfumes%')
  if (menus?.length) {
    const idsMenu = menus
      .filter((m) => {
        const href = String(m.href || '')
        // exact perfumes collection, not femininos/masculinos
        return (
          m.slug === 'perfumes' ||
          href.endsWith('/colecoes/perfumes') ||
          href.includes('/colecoes/perfumes?') ||
          href.includes('/colecoes/perfumes/')
        )
      })
      .filter((m) => !String(m.href || '').includes('perfumes-femininos') && !String(m.href || '').includes('perfumes-masculinos') && m.slug !== 'perfumes-femininos' && m.slug !== 'perfumes-masculinos')
      .map((m) => m.id)
    // safer filter
    const toDelete = menus.filter(
      (m) =>
        m.slug === 'perfumes' ||
        String(m.href || '').replace(/\/$/, '') === '/colecoes/perfumes'
    )
    if (toDelete.length) {
      const { error } = await sb
        .from('menu_items')
        .delete()
        .in(
          'id',
          toDelete.map((m) => m.id)
        )
      if (error) throw error
      console.log(
        'deleted menu items',
        toDelete.map((m) => m.href)
      )
    }
  }

  // Fetch media rows then storage remove + delete
  const assets = []
  await chunked(mediaToDelete, 100, async (chunk) => {
    const { data, error } = await sb
      .from('media_assets')
      .select('id, bucket, storage_path')
      .in('id', chunk)
    if (error) throw error
    assets.push(...(data || []))
  })

  // Group by bucket for storage remove
  const byBucket = {}
  for (const a of assets) {
    byBucket[a.bucket] = byBucket[a.bucket] || []
    byBucket[a.bucket].push(a.storage_path)
    const base = a.storage_path.replace(/\.(webp|jpe?g|png|gif|avif)$/i, '')
    if (base !== a.storage_path) {
      byBucket[a.bucket].push(`${base}.thumb.webp`, `${base}.medium.webp`)
    }
  }
  for (const [bucket, paths] of Object.entries(byBucket)) {
    await chunked(paths, 50, async (chunk) => {
      const { error } = await sb.storage.from(bucket).remove(chunk)
      if (error) console.warn('storage remove warn', bucket, error.message)
    })
    console.log('storage cleared', bucket, paths.length)
  }

  await chunked(
    assets.map((a) => a.id),
    100,
    async (chunk) => {
      const { error } = await sb.from('media_assets').delete().in('id', chunk)
      if (error) throw error
    }
  )
  console.log('deleted media_assets', assets.length)

  // Final counts
  const { count: productsLeft } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
  const { count: catsLeft } = await sb
    .from('categories')
    .select('*', { count: 'exact', head: true })
  const { data: cats } = await sb.from('categories').select('slug,name')
  console.log(
    JSON.stringify(
      {
        productsLeft,
        categoriesLeft: catsLeft,
        categories: cats,
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
