const u = 'https://data-exporter.belezanaweb.com.br/sitemap/1/produto1.xml'
const t = await fetch(u).then((r) => r.text())
console.log('len', t.length)
console.log(t.slice(0, 800))
console.log('gtin', t.includes('3614271716156'))
const urls = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].slice(0, 5).map((m) => m[1])
console.log('sample urls', urls)
