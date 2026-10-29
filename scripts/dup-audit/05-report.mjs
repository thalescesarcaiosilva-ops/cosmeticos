// Consolida pares + GTIN + uso (vendas/views/imagens) e gera relatorio de duplicados.
import fs from 'node:fs'
import { norm } from '../size-enrich/lib.mjs'

const { pairs } = JSON.parse(fs.readFileSync('scripts/dup-audit/pairs.json', 'utf8'))
const base = JSON.parse(fs.readFileSync('scripts/dup-audit/result.json', 'utf8'))
const usage = JSON.parse(fs.readFileSync('scripts/dup-audit/usage.json', 'utf8'))
const all = JSON.parse(fs.readFileSync('scripts/dup-audit/all.json', 'utf8'))
const imgg = JSON.parse(fs.readFileSync('scripts/dup-audit/imggroups.json', 'utf8'))
const byId = Object.fromEntries(all.map((r) => [r.id, r]))

// Regras que separam VARIANTES reais (nao sao duplicatas). any: casa em um so lado ja separa; both: so se ambos casam e diferem.
const RULES = [
  ['any', /cloudy/], ['any', /iluminador|contorno/], ['any', /\brico\b|\briche\b/], ['any', /airy smooth/],
  ['both', /efeito (brilho|seco|black|matte)/], ['any', /hydrating|\bstyling\b/], ['both', /\bleve\b|\bnutritivo\b|\bforte\b/],
  ['any', /super forte|extra forte/], ['any', /daywear.*matte|matte.*daywear/], ['any', /medio intense|intense$/], ['any', /extra clara|muito claro|morena mais|\brio\b/],
  ['any', /oil control|de volume|alinhador/], ['any', /silver\b(?!.*savior)/], ['both', /purple|blue/],
  ['any', /sem acetona|com acetona|lavanda|argan\b.*acetona/], ['any', /tinted/], ['both', /noturno|nutritivo|antissinais/],
  ['any', /\bshampoo a seco\b/], ['any', /\bhello kitty\b.*(glow kitty|nuvem)/], ['any', /sheer/], ['any', /creme de la mer/],
  ['any', /hydra zen glow/], ['any', /\bkit\b/], ['any', /perfect serum/],
]
const nn = (s) => norm(s)
function separated(a, b) {
  const x = nn(a.name), y = nn(b.name)
  if ((/premium touch hair oil 70/.test(x) && /\bleve\b/.test(y)) || (/premium touch hair oil 70/.test(y) && /\bleve\b/.test(x))) return true
  for (const [mode, re] of RULES) {
    if (re.source === 'perfect serum') continue
    const m1 = x.match(re)?.[0] ?? null, m2 = y.match(re)?.[0] ?? null
    if (mode === 'any' ? m1 !== m2 : m1 && m2 && m1 !== m2) return true
  }
  return false
}
// "Perfect Serum Styling" so e dupe se ambos tem styling: coberto por 'styling' (any) acima.

const edges = [] // {a,b,tier,why}
const add = (a, b, tier, why) => edges.push({ a, b, tier, why })

for (const g of base.gtin) {
  const l = g.items
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) add(l[i], l[j], 'CONFIRMADO', 'mesmo GTIN ' + g.key)
}
for (const p of pairs) {
  if (!['ALTA', 'MEDIA', 'REVISAR'].includes(p.tier)) continue
  if (separated(p.a, p.b)) continue
  if (/^kit\b/i.test(p.a.name) && /^kit\b/i.test(p.b.name) && p.tier !== 'ALTA') continue
  const gt = p.a.gtin && p.b.gtin ? (p.a.gtin === p.b.gtin ? 'GTIN igual' : 'GTIN diferente') : 'sem GTIN p/ comparar'
  // GTIN diferente => provavelmente produtos distintos (ou GTIN errado): rebaixa
  let tier = p.tier === 'ALTA' ? 'ALTA' : p.tier === 'MEDIA' ? 'MEDIA' : 'PROVAVEL'
  if (gt === 'GTIN diferente') tier = tier === 'ALTA' ? 'MEDIA' : 'REVISAR_GTIN'
  add(p.a, p.b, tier, `nome ~ (${p.diff.join(', ') || 'identico'}); tamanho ${p.sz}; ${gt}`)
}
const ex = JSON.parse(fs.readFileSync('scripts/dup-audit/extra.json', 'utf8'))
const fm = (id) => { const r = byId[id]; return { id, name: r.name, slug: r.slug, gtin: r.gtin } }
const jac = (x, y) => { const A = new Set(norm(x).split(' ')), B = new Set(norm(y).split(' ')); return [...A].filter((t) => B.has(t)).length / new Set([...A, ...B]).size }
const gtinConflicts = []
for (const [n1, g1, n2, g2, i1, i2] of ex.near) {
  if (jac(n1, n2) >= 0.5 && !/perfecting concentrate/i.test(n1 + n2) && !separated({ name: n1 }, { name: n2 })) add(fm(i1), fm(i2), 'CONFIRMADO', `GTIN quase igual (${g1} / ${g2})`)
  else gtinConflicts.push({ a: n1, ga: g1, b: n2, gb: g2 })
}
const TONEW = new Set('clara claro escura escuro morena moreno negra negro media medio bege ivory light medium sand dark deep tan golden warm cool natural rosa pink berry incolor nude preto marrom castanho loiro refil kit sheer intense'.split(' '))
const have = new Set(edges.map((e) => [e.a.id, e.b.id].sort().join('|')))
for (const [n, na, nb, ia, ib, diff] of ex.wide) {
  if (have.has([ia, ib].sort().join('|'))) continue
  if (/\b(refil|kit)\b/i.test(na + ' ' + nb)) continue
  if (diff.some((t) => TONEW.has(t) || /\d/.test(t))) continue
  if (separated({ name: na }, { name: nb })) continue
  add(fm(ia), fm(ib), 'POSSIVEL', `nome contido (+${diff.join(', ')})`)
}
// mesma imagem (media id) + nome parecido
const seenImg = new Set()
for (const grp of imgg.sameMedia) {
  for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) seenImg.add([grp[i], grp[j]].sort().join('|'))
}

// ---- clusters
const rank = { CONFIRMADO: 4, ALTA: 3, MEDIA: 2, PROVAVEL: 1, POSSIVEL: 0.5, REVISAR_GTIN: 0 }
const parent = {}
const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
const nodes = {}
for (const e of edges) { for (const n of [e.a, e.b]) { nodes[n.id] = n; parent[n.id] ??= n.id } parent[find(e.a.id)] = find(e.b.id) }
const groups = {}
for (const id of Object.keys(nodes)) (groups[find(id)] ||= { ids: [], edges: [] }).ids.push(id)
for (const e of edges) groups[find(e.a.id)].edges.push(e)

const score = (id) => {
  const u = (k) => usage[k]?.[id] || 0
  const r = byId[id]
  return u('sold') * 1000 + u('reviews') * 200 + u('views') * 2 + (u('images') ? 30 : 0) + (r.gtin ? 20 : 0) + (r.size_label ? 5 : 0) + (r.description ? 5 : 0) + (r.original_price ? 2 : 0)
}
const out = []
let gi = 0
const sorted = Object.values(groups).sort((x, y) => Math.max(...y.edges.map((e) => rank[e.tier])) - Math.max(...x.edges.map((e) => rank[e.tier])))
for (const g of sorted) {
  gi++
  const best = Math.max(...g.edges.map((e) => rank[e.tier]))
  const tier = Object.keys(rank).find((k) => rank[k] === best)
  const ids = g.ids.sort((a, b) => score(b) - score(a))
  const sizeInNameMix = new Set(ids.map((id) => /\d\s*(ml|g|kg|l|gr)\b/i.test(byId[id].name))).size > 1
  const szKey = (id) => (byId[id].size_label || '').replace(/\s+/g, '').toLowerCase()
  const sizes = new Set(ids.map(szKey).filter(Boolean))
  const seenSize = new Set()
  ids.forEach((id, k) => {
    const r = byId[id]
    const s = szKey(id)
    let acao
    if (sizes.size > 1 && !s) acao = 'DEFINIR TAMANHO (sem tamanho: unificar com o correto)'
    else if (!seenSize.has(s)) { acao = 'MANTER (sugerido)'; seenSize.add(s) } else acao = 'UNIFICAR/DESATIVAR'
    const brand = Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name
    out.push({
      grupo: gi, confianca: tier, acao, nome: r.name, marca: brand || '', tamanho: r.size_label || '',
      preco: r.price, estoque: r.stock, vendidos: usage.sold[id] || 0, views: usage.views[id] || 0, imagens: usage.images[id] || 0, avaliacoes: usage.reviews[id] || 0,
      gtin: r.gtin || '', sku: r.sku || '', slug: r.slug, url: 'https://www.batistacosmeticos.com.br/produto/' + r.slug,
      tamanho_so_em_um_nome: sizeInNameMix ? 'sim' : '', motivo: k === 0 ? g.edges.map((e) => e.why).slice(0, 2).join(' | ') : '',
    })
  })
}
fs.writeFileSync('scripts/dup-audit/final.json', JSON.stringify({ out, groups: sorted.length, gtinConflicts }, null, 1))
const cols = Object.keys(out[0])
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
fs.writeFileSync('relatorio-produtos-duplicados.csv', '\uFEFF' + cols.join(';') + '\n' + out.map((r) => cols.map((c) => esc(r[c])).join(';')).join('\n'))
const cnt = {}
for (const g of sorted) { const b = Math.max(...g.edges.map((e) => rank[e.tier])); const t = Object.keys(rank).find((k) => rank[k] === b); cnt[t] = (cnt[t] || 0) + 1 }
console.log({ grupos: sorted.length, produtos: out.length, porConfianca: cnt, produtosParaUnificar: out.filter((o) => o.acao.startsWith('UNIF')).length })





