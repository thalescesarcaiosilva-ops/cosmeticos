const gtin = '3614271716156'
const urls = [
  'https://www.sephora.com.br/busca/?q=' + encodeURIComponent('Monsieur Big Lancôme'),
  'https://www.sephora.com.br/mascara-de-cilios-lancome-monsieur-big-3614271716156.html',
  'https://prod.sfcc.sephora.com.br/mascara-de-cilios-lancome-monsieur-big-3614271716156.html',
]

for (const u of urls) {
  const r = await fetch(u, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'pt-BR' },
    redirect: 'follow',
  })
  const html = await r.text()
  const priceMatch = html.match(/R\$\s*([\d.]+,\d{2})/)
  console.log(u, 'status', r.status, 'final', r.url, 'price', priceMatch?.[0])
}
