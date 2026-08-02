const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
const urls = [
  site ? `${site}/feed/google-merchant` : null,
  'https://www.batistacosmeticos.com.br/feed/google-merchant',
].filter(Boolean)

;(async () => {
  console.log('env site', site || '(empty)')
  for (const u of urls) {
    const res = await fetch(u, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      cache: 'no-store',
    })
    const text = await res.text()
    const items = (text.match(/<item>/g) || []).length
    console.log(
      JSON.stringify(
        {
          url: u,
          status: res.status,
          cacheControl: res.headers.get('cache-control'),
          age: res.headers.get('age'),
          xVercelCache: res.headers.get('x-vercel-cache'),
          items,
          bytes: text.length,
        },
        null,
        2
      )
    )
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
