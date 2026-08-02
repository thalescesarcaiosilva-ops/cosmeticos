async function main() {
  const res = await fetch('https://www.batistacosmeticos.com.br/sitemap-collections.xml', {
    cache: 'no-store',
  })
  const text = await res.text()
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  console.log(
    JSON.stringify(
      {
        status: res.status,
        age: res.headers.get('age'),
        xVercelCache: res.headers.get('x-vercel-cache'),
        n: locs.length,
        locs,
        hasGenericPerfumes: locs.some(
          (u) => /\/colecoes\/perfumes\/?$/.test(u)
        ),
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
