const t = await fetch('https://www.belezanaweb.com.br/sitemap-index.xml').then((r) => r.text())
const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
console.log(locs.join('\n'))
