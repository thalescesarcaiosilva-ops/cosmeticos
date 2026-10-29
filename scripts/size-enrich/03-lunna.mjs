// Consulta pública à página do MESMO slug na Lunna (loja irmã): tamanho exibido + variantes com GTIN.
import { readCache, writeCache, UA, sleep } from './lib.mjs'

const products = readCache('products.json', [])
const targets = products.filter((p) => p.nameSizes.length === 0)
const cache = readCache('lunna.json', {})

function parse(html) {
  const out = { titleSize: null, mainGtin: null, variants: [] }
  const t = html.match(/<span class="pdp-title-size">([^<]+)<\/span>/)
  if (t) out.titleSize = t[1].trim()
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  for (const m of ld) {
    try {
      let j = JSON.parse(m[1])
      if (Array.isArray(j)) j = j.find((x) => x['@type'] === 'Product') || j[0]
      if (j?.['@type'] !== 'Product') continue
      out.mainGtin = j.gtin13 || j.gtin || null
      out.name = j.name
      const offers = Array.isArray(j.offers) ? j.offers : j.offers ? [j.offers] : []
      for (const o of offers) {
        const nm = /Tamanho:\s*(.+)$/i.exec(o.name || '')
        out.variants.push({ size: nm ? nm[1].trim() : null, gtin: o.gtin13 || o.gtin || null })
      }
    } catch {}
  }
  return out
}

let done = 0
const queue = targets.filter((p) => !(p.slug in cache))
async function worker() {
  while (queue.length) {
    const p = queue.shift()
    try {
      const r = await fetch('https://lunnacosmeticosbrasil.com/produto/' + p.slug, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(30000),
      })
      if (r.status === 404) cache[p.slug] = { status: 404 }
      else if (!r.ok) cache[p.slug] = { status: r.status }
      else cache[p.slug] = { status: 200, ...parse(await r.text()) }
    } catch (e) {
      cache[p.slug] = { status: 0, error: e.message }
    }
    if (++done % 50 === 0) {
      writeCache('lunna.json', cache)
      console.log('lunna', done, '/', done + queue.length)
    }
    await sleep(150)
  }
}
await Promise.all(Array.from({ length: 5 }, worker))
writeCache('lunna.json', cache)
const vals = targets.map((p) => cache[p.slug])
console.log({
  targets: targets.length,
  ok: vals.filter((v) => v?.status === 200).length,
  notFound: vals.filter((v) => v?.status === 404).length,
  other: vals.filter((v) => v && v.status !== 200 && v.status !== 404).length,
  withTitleSize: vals.filter((v) => v?.titleSize).length,
})
