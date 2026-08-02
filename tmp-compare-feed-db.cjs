const { createClient } = require('@supabase/supabase-js')

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const site = 'https://www.batistacosmeticos.com.br'
const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const feedRes = await fetch(`${site}/feed/google-merchant`, { cache: 'no-store' })
  const feedXml = await feedRes.text()
  const feedIds = [...feedXml.matchAll(/<g:id>([^<]+)<\/g:id>/g)].map((m) => m[1])
  const feedSlugs = [...feedXml.matchAll(/\/produto\/([^<]+)<\/link>/g)].map((m) =>
    decodeURIComponent(m[1])
  )

  const smRes = await fetch(`${site}/sitemap-products.xml`, { cache: 'no-store' })
  const smXml = await smRes.text()
  const smSlugs = [...smXml.matchAll(/\/produto\/([^<]+)<\/loc>/g)].map((m) =>
    decodeURIComponent(m[1])
  )

  // load all active slugs from supabase
  const slugs = new Set()
  let from = 0
  for (;;) {
    const { data, error } = await sb.from('products').select('id, slug, active').range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    for (const p of data) slugs.add(p.slug)
    if (data.length < 1000) break
    from += 1000
  }

  const feedNotInDb = feedSlugs.filter((s) => !slugs.has(s)).slice(0, 15)
  const smNotInDb = smSlugs.filter((s) => !slugs.has(s)).slice(0, 15)
  const feedInDb = feedSlugs.filter((s) => slugs.has(s)).length
  const smInDb = smSlugs.filter((s) => slugs.has(s)).length

  // check a not-in-db URL status
  let deadStatus = null
  if (smNotInDb[0]) {
    const r = await fetch(`${site}/produto/${smNotInDb[0]}`, {
      redirect: 'manual',
      cache: 'no-store',
    })
    deadStatus = r.status
  }

  console.log(
    JSON.stringify(
      {
        project: String(url).replace('https://', '').split('.')[0],
        dbSlugCount: slugs.size,
        feed: {
          items: feedIds.length,
          inDb: feedInDb,
          missingFromDb: feedSlugs.length - feedInDb,
          sampleMissing: feedNotInDb,
          xVercelCache: feedRes.headers.get('x-vercel-cache'),
          age: feedRes.headers.get('age'),
        },
        sitemapProducts: {
          urls: smSlugs.length,
          inDb: smInDb,
          missingFromDb: smSlugs.length - smInDb,
          sampleMissing: smNotInDb,
          sampleMissingHttp: deadStatus,
          xVercelCache: smRes.headers.get('x-vercel-cache'),
          age: smRes.headers.get('age'),
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
