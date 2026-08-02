const fs = require('fs')

async function main() {
  const res = await fetch(
    'https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search?fq=productId:4196',
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }
  )
  const data = await res.json()
  const p = data[0]
  const link = p.link?.startsWith('http')
    ? p.link
    : `https://www.epocacosmeticos.com.br${p.linkText ? `/${p.linkText}/p` : p.link}`

  console.log('link', link)

  const htmlRes = await fetch(link, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  })
  const html = await htmlRes.text()
  fs.writeFileSync('tmp-epoca-sample.html', html)
  console.log('html bytes', html.length, 'status', htmlRes.status)

  const snippets = []
  const reList = [
    /(\d[\d.]*)\s*avalia(?:ções|cao|ção)/gi,
    /reviewCount["']?\s*[:=]\s*["']?(\d+)/gi,
    /"ratingValue"\s*:\s*"?([\d.]+)"?/gi,
    /aggregateRating/gi,
    /trustvox/gi,
    /yourviews/gi,
    /"totalReviews"\s*:\s*(\d+)/gi,
    /"reviews"\s*:\s*(\d+)/gi,
  ]
  for (const re of reList) {
    const matches = [...html.matchAll(re)].slice(0, 8)
    if (matches.length) {
      snippets.push({
        re: String(re),
        matches: matches.map((m) => m[0].slice(0, 100)),
      })
    }
  }
  console.log(JSON.stringify(snippets, null, 2))

  // __STATE__ or __NEXT_DATA__
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (next) {
    const j = JSON.parse(next[1])
    const s = JSON.stringify(j)
    const i = s.toLowerCase().indexOf('review')
    console.log('NEXT_DATA review idx', i)
    if (i >= 0) console.log(s.slice(i - 60, i + 160))
  }

  const state = html.match(/__STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/)
  if (state) console.log('has __STATE__', state[1].length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
