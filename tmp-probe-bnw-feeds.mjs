const paths = [
  '/feeds/google-shopping.xml',
  '/feeds/google.xml',
  '/feeds/products.xml',
  '/google-shopping.xml',
  '/google.xml',
  '/catalog.xml',
  '/products.xml',
  '/export/products.json',
  '/export/catalog.json',
  '/sitemap/1/products.xml',
]
for (const p of paths) {
  const url = `https://data-exporter.belezanaweb.com.br${p}`
  const res = await fetch(url)
  const text = await res.text()
  console.log(p, res.status, text.slice(0, 100).replace(/\s+/g, ' '))
}
