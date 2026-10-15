const gtin = '3614271716156'
const paths = [
  `/product/${gtin}`,
  `/products/${gtin}`,
  `/catalog/${gtin}`,
  `/gtin/${gtin}`,
  `/ean/${gtin}`,
  `/api/product/${gtin}`,
  `/feeds/google/${gtin}`,
  `/sitemap/1/busca.xml`,
]
for (const p of paths) {
  const url = `https://data-exporter.belezanaweb.com.br${p}`
  const res = await fetch(url, { headers: { Accept: 'application/json, application/xml' } })
  const text = await res.text()
  console.log(p, res.status, text.slice(0, 150).replace(/\s+/g, ' '))
}
