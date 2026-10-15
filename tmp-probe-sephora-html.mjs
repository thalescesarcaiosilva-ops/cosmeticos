const query = process.argv[2] || 'Monsieur Big Lancôme'
const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Accept: 'text/html',
}

const url = `https://www.sephora.com.br/busca/?q=${encodeURIComponent(query)}`
const html = await fetch(url, { headers }).then((r) => r.text())

const needles = ['client_id', 'clientId', 'product_search', 'c_price', 'Monsieur', '97,00', '9700', '3614271716156']
for (const n of needles) {
  const i = html.indexOf(n)
  console.log(n, i >= 0 ? html.slice(Math.max(0, i - 60), i + 120).replace(/\s+/g, ' ') : 'missing')
}

const scripts = [...html.matchAll(/<script[^>]*>([\s\S]{0,50000}?)<\/script>/gi)]
  .map((m) => m[1])
  .filter((s) => /product|price|Monsieur|hits/i.test(s))
console.log('interesting scripts', scripts.length)
for (const s of scripts.slice(0, 3)) {
  console.log('--- script snippet ---')
  console.log(s.slice(0, 800))
}
