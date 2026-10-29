import { supa, readCache } from './lib.mjs'
const db = supa()
const ids = new Set(Object.keys(readCache('descriptions.json', {})))
const rows = await db.select('products?select=id,name,slug,description&active=eq.true')
// sem \b (que falha com letras acentuadas como "É")
const STORE = /(épo?ca cosm|\bépoca\b|(^|[^a-z])época([^a-z]|$)|epoca cosm|beleza na web|belezanaweb|sephora|drogasil|droga raia|raia drogasil|pague menos|panvel|amobeleza|mercado livre|lunna|giraofertas|farmácia|drogaria|perfumaria|nossa loja|nosso site|nossa equipe|nossos? clientes?|garanta já|adquira|acesse (a|o|nosso)|confira já|garantia|nota fiscal|envio|frete|desconto no pix|parcelamento)/i
const text = (h) => h.replace(/<\/(p|li|h3)>/g, '\n').replace(/<[^>]+>/g, ' ').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
const out = { novas: [], antigas: [] }
for (const r of rows) {
  const isNew = ids.has(r.id)
  for (const l of text(r.description || '')) {
    const m = STORE.exec(l)
    if (!m) continue
    if (r.name.toLowerCase().includes(m[0].toLowerCase())) continue
    out[isNew ? 'novas' : 'antigas'].push({ name: r.name, slug: r.slug, termo: m[0], ctx: l.slice(Math.max(0, m.index - 80), m.index + 110) })
  }
}
const group = (arr) => {
  const g = {}
  for (const x of arr) (g[x.termo.toLowerCase()] ||= []).push(x)
  return g
}
for (const k of ['novas', 'antigas']) {
  console.log(`\n===== ${k.toUpperCase()}: ${out[k].length} linhas, ${new Set(out[k].map((x) => x.slug)).size} produtos`)
  for (const [t, v] of Object.entries(group(out[k])).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n## "${t}" x${v.length} (${new Set(v.map((x) => x.slug)).size} produtos)`)
    for (const x of v.slice(0, k === 'novas' ? 8 : 2)) console.log(`   - [${x.name.slice(0, 55)}] ...${x.ctx}...`)
  }
}
