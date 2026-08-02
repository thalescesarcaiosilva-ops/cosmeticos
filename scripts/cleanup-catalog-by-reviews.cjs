/**
 * Limpeza de catálogo (aprovada pelo usuário):
 * - Remove categoria "perfumes" + seus 28 produtos
 * - Em masc/fem e demais categorias: remove produtos com <150 avaliações Época
 * - Remove kit Real Techniques sem match
 * - Apaga imagens órfãs no Storage
 * - NÃO altera produtos mantidos (ids / public_url)
 *
 * Uso: node --env-file=.env.local scripts/cleanup-catalog-by-reviews.cjs
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
        keepEstimate: 1000 - ids.length,
      },
      null,
      2
    )
  )

  const mediaIds = new Set()
  await chunked(ids, 150, async (chunk) => {
    const { data, error } = await sb
      .from('product_images')
      .select('media_id, product_id')
      .in('product_id', chunk)
    if (error) throw error
    for (const row of data || []) if (row.media_id) mediaIds.add(row.media_id)
  })

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

  const childTables = [
    'product_favorites',
    'product_reviews',
    'product_variations',
    'product_views_daily',
    'product_images',
    'product_categories',
  ]

  // bundles separately
  await chunked(ids, 100, async (chunk) => {
    const { error: e1 } = await sb.from('product_bundles').delete().in('primary_product_id', chunk)
    if (e1 && !/does not exist|Could not find/i.test(e1.message)) throw e1
    const { error: e2 } = await sb.from('product_bundles').delete().in('companion_product_id', chunk)
    if (e2 && !/does not exist|Could not find/i.test(e2.message)) throw e2
  })
  console.log('cleared product_bundles')

  for (const table of childTables) {
    await chunked(ids, 100, async (chunk) => {
      const { error } = await sb.from(table).delete().in('product_id', chunk)
      if (error) {
        if (/does not exist|Could not find/i.test(error.message)) {
          console.warn('skip', table, error.message)
          return
        }
        throw error
      }
    })
    console.log('cleared', table)
  }

  let deletedProducts = 0
  await chunked(ids, 50, async (chunk) => {
    const { data, error } = await sb.from('products').delete().in('id', chunk).select('id')
    if (error) throw error
    deletedProducts += (data || []).length
  })
  console.log('deleted products', deletedProducts)

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

  const { data: menus } = await sb.from('menu_items').select('id, href, slug')
  const toDeleteMenus = (menus || []).filter((m) => {
    const href = String(m.href || '').replace(/\/$/, '')
    return m.slug === 'perfumes' || href === '/colecoes/perfumes'
  })
  if (toDeleteMenus.length) {
    const { error } = await sb
      .from('menu_items')
      .delete()
      .in(
        'id',
        toDeleteMenus.map((m) => m.id)
      )
    if (error) throw error
    console.log(
      'deleted menu items',
      toDeleteMenus.map((m) => ({ slug: m.slug, href: m.href }))
    )
  }

  const assets = []
  await chunked(mediaToDelete, 100, async (chunk) => {
    const { data, error } = await sb
      .from('media_assets')
      .select('id, bucket, storage_path')
      .in('id', chunk)
    if (error) throw error
    assets.push(...(data || []))
  })

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

  const { count: productsLeft } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
  const { data: cats } = await sb.from('categories').select('slug,name')
  const { count: fem } = await sb
    .from('product_categories')
    .select('*', { count: 'exact', head: true })
    .eq(
      'category_id',
      (cats || []).find((c) => c.slug === 'perfumes-femininos')
        ? (
            await sb.from('categories').select('id').eq('slug', 'perfumes-femininos').single()
          ).data.id
        : '00000000-0000-0000-0000-000000000000'
    )
  console.log(
    JSON.stringify(
      {
        productsLeft,
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
