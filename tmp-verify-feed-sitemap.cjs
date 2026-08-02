const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.batistacosmeticos.com.br').replace(
  /\/$/,
  ''
)

async function fetchXml(path) {
  const res = await fetch(`${site}${path}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  })
  const text = await res.text()
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const items = (text.match(/<item>/g) || []).length
  return {
    path,
    status: res.status,
    age: res.headers.get('age'),
    xVercelCache: res.headers.get('x-vercel-cache'),
    cacheControl: res.headers.get('cache-control'),
    locs: locs.length,
    items,
    productLocs: locs.filter((u) => u.includes('/produto/')),
    collectionLocs: locs.filter((u) => u.includes('/colecoes/')),
    sampleLocs: locs.slice(0, 8),
  }
}

async function main() {
  const projectRef = String(url || '').replace('https://', '').split('.')[0]
  console.log('projectRef', projectRef)

  if (projectRef !== 'yqyquwimvvpffdaqvnul') {
    console.error('ERRO: .env.local não aponta para yqyquwimvvpffdaqvnul')
    process.exit(1)
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { count: productsAll } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
  const { count: productsActive } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
  const { count: productsInactive } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('active', false)

  const { data: cats } = await sb
    .from('categories')
    .select('id, slug, name, active')
    .order('sort_order', { ascending: true })

  const catStats = []
  for (const c of cats || []) {
    const { count } = await sb
      .from('product_categories')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', c.id)
    catStats.push({
      slug: c.slug,
      name: c.name,
      active: c.active,
      products: count || 0,
    })
  }

  const feed = await fetchXml('/feed/google-merchant')
  const smProducts = await fetchXml('/sitemap-products.xml')
  const smCollections = await fetchXml('/sitemap-collections.xml')
  const smIndex = await fetchXml('/sitemap.xml')

  // spot-check a few sitemap product URLs
  let ok = 0
  let notFound = 0
  for (const p of smProducts.productLocs.slice(0, 10)) {
    const r = await fetch(p, { method: 'GET', redirect: 'manual', cache: 'no-store' })
    if (r.status === 200) ok++
    else if (r.status === 404) notFound++
  }

  console.log(
    JSON.stringify(
      {
        supabase: {
          projectRef,
          productsAll,
          productsActive,
          productsInactive,
          categories: catStats,
          hasGenericPerfumes: catStats.some((c) => c.slug === 'perfumes'),
        },
        feed: {
          status: feed.status,
          items: feed.items,
          age: feed.age,
          xVercelCache: feed.xVercelCache,
          matches402: feed.items === 402,
        },
        sitemapProducts: {
          status: smProducts.status,
          urls: smProducts.productLocs.length,
          age: smProducts.age,
          xVercelCache: smProducts.xVercelCache,
          matches402: smProducts.productLocs.length === 402,
          sampleCheck10: { ok, notFound },
        },
        sitemapCollections: {
          status: smCollections.status,
          urls: smCollections.collectionLocs.length,
          locs: smCollections.collectionLocs,
          hasGenericPerfumes: smCollections.collectionLocs.some((u) =>
            /\/colecoes\/perfumes\/?$/.test(u)
          ),
          age: smCollections.age,
          xVercelCache: smCollections.xVercelCache,
        },
        sitemapIndex: {
          status: smIndex.status,
          locs: smIndex.locs,
          sampleLocs: smIndex.sampleLocs,
          age: smIndex.age,
          xVercelCache: smIndex.xVercelCache,
        },
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
