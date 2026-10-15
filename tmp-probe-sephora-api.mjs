const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
}

const q = process.argv[2] || '3614271716156'
const endpoints = [
  `https://www.sephora.com.br/on/demandware.store/Sites-Sephora_BR-Site/pt_BR/Search-GetSuggestions?q=${encodeURIComponent(q)}`,
  `https://www.sephora.com.br/on/demandware.store/Sites-Sephora_BR-Site/pt_BR/SearchServices-GetSuggestions?q=${encodeURIComponent(q)}`,
  `https://www.sephora.com.br/on/demandware.store/Sites-Sephora_BR-Site/pt_BR/Search-Show?q=${encodeURIComponent(q)}&format=page-element`,
  `https://www.sephora.com.br/on/demandware.store/Sites-Sephora_BR-Site/pt_BR/Search-UpdateGrid?q=${encodeURIComponent(q)}&start=0&sz=24&format=page-element`,
]

for (const url of endpoints) {
  const res = await fetch(url, { headers: { ...headers, Referer: 'https://www.sephora.com.br/' } })
  const text = await res.text()
  console.log('\nURL', url.split('/pt_BR/')[1]?.slice(0, 80))
  console.log('status', res.status, 'ctype', res.headers.get('content-type'), 'len', text.length)
  const priceHits = [...text.matchAll(/R\$\s*([0-9.,]+)/g)].slice(0, 5).map((m) => m[0])
  console.log('prices', priceHits)
  if (text.length < 800) console.log(text)
  else console.log(text.slice(0, 400).replace(/\s+/g, ' '))
}
