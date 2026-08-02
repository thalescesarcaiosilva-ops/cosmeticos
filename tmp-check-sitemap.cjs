const urls = [
  'https://www.batistacosmeticos.com.br/sitemap-products.xml',
  'https://www.batistacosmeticos.com.br/sitemap.xml',
]

async function main() {
  for (const u of urls) {
    const res = await fetch(u, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    const text = await res.text()
    const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    const products = locs.filter((x) => x.includes('/produto/'))
    console.log(
      JSON.stringify(
        {
          url: u,
          status: res.status,
          cacheControl: res.headers.get('cache-control'),
          age: res.headers.get('age'),
          xVercelCache: res.headers.get('x-vercel-cache'),
          locs: locs.length,
          products: products.length,
          sampleProducts: products.slice(0, 3),
        },
        null,
        2
      )
    )

    if (products.length) {
      // spot-check first 12 product URLs for status
      const sample = products.slice(0, 12)
      let ok = 0
      let notFound = 0
      let other = 0
      for (const p of sample) {
        const r = await fetch(p, {
          method: 'GET',
          redirect: 'manual',
          cache: 'no-store',
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        if (r.status === 200) ok++
        else if (r.status === 404) notFound++
        else other++
      }
      console.log(JSON.stringify({ sampleCheck: { n: sample.length, ok, notFound, other } }))
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
