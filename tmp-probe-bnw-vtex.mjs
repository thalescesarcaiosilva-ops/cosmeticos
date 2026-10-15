const gtin = '3614271716156'
const bases = [
  'https://belezanaweb.vtexcommercestable.com.br',
  'https://www.belezanaweb.com.br',
  'https://beleza-na-web.vtexcommercestable.com.br',
  'https://blz.vtexcommercestable.com.br',
  'https://olist.vtexcommercestable.com.br',
]
for (const base of bases) {
  const url = `${base}/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:${gtin}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const text = await res.text()
    let price
    try {
      const j = JSON.parse(text)
      price = j?.[0]?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price
    } catch {}
    console.log(base, res.status, 'price', price, text.slice(0, 100).replace(/\s+/g, ' '))
  } catch (e) {
    console.log(base, 'err', e.message)
  }
}
