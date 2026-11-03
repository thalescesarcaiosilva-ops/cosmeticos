import fs from 'node:fs'

const url = 'https://www.epocacosmeticos.com.br/creme-hidratante-corporal-fisiogel-hipoalergenico-450g-155767/p'
const r = await fetch(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR',
  },
})
const t = await r.text()
fs.writeFileSync('scripts/epoca-sync/_page.html', t)
console.log('status', r.status, 'len', t.length)
const scripts = [...t.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
console.log('scripts', scripts.slice(0, 30))
const idx = t.toLowerCase().indexOf('__state__')
console.log('state', idx)
const priceIdx = t.indexOf('65')
console.log('65 idx', priceIdx)
