const gtin = process.argv[2] || '3614271716156'

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

function brToNum(s) {
  if (!s) return null
  const n = Number(String(s).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

async function epoca(gtin) {
  const url = `https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:${encodeURIComponent(gtin)}`
  const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  const row = data?.[0]
  const offer = row?.items?.[0]?.sellers?.[0]?.commertialOffer
  if (!offer?.IsAvailable) return null
  return {
    store: 'epoca',
    price: Number(offer.Price),
    url: `https://www.epocacosmeticos.com.br/${row.linkText}/p`,
  }
}

async function sephoraHtml(query) {
  const url = `https://www.sephora.com.br/busca/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { ...headers, Accept: 'text/html' } })
  const html = await res.text()
  const clientMatch = html.match(/client_id=([a-z0-9_-]+)/i) || html.match(/"clientId"\s*:\s*"([^"]+)"/i)
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
  const offers = []
  for (const m of ldBlocks) {
    try {
      const j = JSON.parse(m[1])
      const list = Array.isArray(j) ? j : [j]
      for (const item of list) {
        if (item?.offers?.price) offers.push(Number(item.offers.price))
        if (item?.offers?.lowPrice) offers.push(Number(item.offers.lowPrice))
      }
    } catch {}
  }
  const reais = [...html.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)].map((x) =>
    brToNum(x[1])
  )
  const minReais = reais.length ? Math.min(...reais.filter((n) => n > 5)) : null
  return { status: res.status, clientId: clientMatch?.[1], ldOffers: offers, minReais, htmlLen: html.length }
}

async function sephoraOcapi(gtin, clientId) {
  if (!clientId) return null
  const url = `https://www.sephora.com.br/s/Sites-Sephora_BR-Site/dw/shop/v22_10/product_search?q=${encodeURIComponent(gtin)}&count=5&client_id=${clientId}`
  const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } })
  if (!res.ok) return { status: res.status, body: (await res.text()).slice(0, 200) }
  const j = await res.json()
  const hits = j?.hits || j?.products || []
  const prices = []
  for (const h of hits) {
    if (h?.price != null) prices.push(Number(h.price))
    if (h?.c_price?.sales?.value != null) prices.push(Number(h.c_price.sales.value))
    if (h?.product_price?.min?.sales?.value != null) prices.push(Number(h.product_price.min.sales.value))
  }
  return { status: res.status, hitCount: hits.length, prices, sample: hits[0] }
}

async function bnwHtml(gtin) {
  const url = `https://www.belezanaweb.com.br/busca?q=${encodeURIComponent(gtin)}`
  const res = await fetch(url, {
    headers: {
      ...headers,
      Accept: 'text/html,application/xhtml+xml',
      Referer: 'https://www.belezanaweb.com.br/',
    },
  })
  const html = await res.text()
  if (/Access Denied|errors\.edgesuite/i.test(html)) {
    return { status: res.status, blocked: true }
  }
  const reais = [...html.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)].map((x) =>
    brToNum(x[1])
  )
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  let nextSnippet = null
  if (next) nextSnippet = next[1].slice(0, 500)
  return {
    status: res.status,
    minReais: reais.length ? Math.min(...reais.filter((n) => n > 5)) : null,
    priceCount: reais.length,
    nextSnippet,
  }
}

console.log('gtin', gtin)
console.log('epoca', await epoca(gtin))
const sep = await sephoraHtml(gtin)
console.log('sephoraHtml', sep)
console.log('sephoraOcapi', await sephoraOcapi(gtin, sep.clientId))
console.log('bnw', await bnwHtml(gtin))
