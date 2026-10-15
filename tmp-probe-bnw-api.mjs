const gtin = '3614271716156'
const urls = [
  `https://www.belezanaweb.com.br/api/search/full?query=${gtin}`,
  `https://www.belezanaweb.com.br/api/search?query=${gtin}`,
  `https://www.belezanaweb.com.br/api/catalog/search?term=${gtin}`,
  `https://www.belezanaweb.com.br/api/v1/products/search?q=${gtin}`,
  `https://www.belezanaweb.com.br/api/v2/products/search?q=${gtin}`,
  `https://www.belezanaweb.com.br/api/products/search?query=${gtin}`,
]
const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.belezanaweb.com.br/',
}
for (const url of urls) {
  const res = await fetch(url, { headers })
  const text = await res.text()
  console.log(url.replace('https://www.belezanaweb.com.br', ''), res.status, text.slice(0, 200).replace(/\s+/g, ' '))
}
