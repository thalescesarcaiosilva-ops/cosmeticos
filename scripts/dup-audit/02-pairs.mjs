// Pares de possiveis duplicados, cross-marca, com niveis de confianca. Somente leitura.
import fs from 'node:fs'
import { norm, findSizes, sizeKey } from '../size-enrich/lib.mjs'

const all = JSON.parse(fs.readFileSync('scripts/dup-audit/all.json', 'utf8'))
const brandOf = (r) => (Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name) || ''

const STOP = new Set('de da do das dos e com para em o a os as um uma the by of and ml g gr kg l un und unidade unidades'.split(' '))
const SYN = { oil: 'oleo', hair: 'capilar', capilares: 'capilar', cabelos: 'capilar', cabelo: 'capilar', xampu: 'shampoo', sampoo: 'shampoo', conditioner: 'condicionador', mask: 'mascara', masque: 'mascara', cream: 'creme', professional: 'profissional', professionals: 'profissional', professionnel: 'profissional', skincare: 'skincare', hidratacao: 'hidratante', protector: 'protetor', 'leave-in': 'leave', labios: 'labial', olhos: 'olhos' }
const DISC = new Set('refil refill kit mini travel trio duo combo sache recarga spray mousse espuma barra liquido liquida'.split(' '))
const TONE = new Set(('clara claro escura escuro morena moreno negra negro media medio bege ivory light medium sand dark deep tan golden warm cool neutral natural rosa pink berry incolor nude tom cor ' +
  'marrom preto preta vermelho vermelha azul verde roxo amarelo laranja branco branca cinza dourado dourada prata bronze rose coral cherry plum mauve ' +
  'loiro loira castanho ruivo grafite chocolate caramelo mel cobre aqua lilas violeta vinho bordo terracota').split(' '))

function effSize(r) {
  if (r.size_label) return sizeKey(r.size_label.replace(/\s+/g, ' ').trim().toUpperCase()) || r.size_label
  const s = findSizes(r.name)
  if (s.length === 1) return sizeKey(s[0].label)
  if (s.length > 1) return 'multi:' + s.map((x) => sizeKey(x.label)).sort().join('+')
  return null
}
function tokens(r) {
  let n = norm(r.name)
  n = n.replace(/(?<![\w.])\d{1,4}(?:\.\d{1,2})?\s*(ml|mililitros?|gr|gramas?|g|kg|mg|l|litros?|oz)(?![a-z0-9])/g, ' ')
  n = n.replace(/\bfps\s*(\d+)/g, 'fps$1').replace(/\bspf\s*(\d+)/g, 'fps$1')
  return [...new Set(n.split(' ').filter(Boolean).map((t) => SYN[t] || t).filter((t) => !STOP.has(t)))]
}

const items = all.filter((r) => r.active).map((r) => {
  const toks = tokens(r)
  return { r, brand: brandOf(r), size: effSize(r), toks, set: new Set(toks) }
})

// df por marca (para achar palavras genericas)
const tokBrands = new Map()
for (const it of items) for (const t of it.toks) { if (!tokBrands.has(t)) tokBrands.set(t, new Set()); tokBrands.get(t).add(it.brand || '-') }
const generic = (t) => (tokBrands.get(t)?.size || 0) >= 8 && !TONE.has(t)

const fmt = (it) => ({ id: it.r.id, name: it.r.name, slug: it.r.slug, brand: it.brand, price: Number(it.r.price), stock: it.r.stock, sku: it.r.sku, gtin: it.r.gtin, size: it.size, woo: it.r.woocommerce_id, created: it.r.created_at, hasImg: !!(it.r.images && it.r.images.length) })

const CLS = { shampoo:'S', condicionador:'C', mascara:'M', tratamento:'M', treatment:'M', leave:'L', serum:'E', oleo:'O', creme:'K' }
const clsOf = (set) => new Set([...set].map((t) => CLS[t]).filter(Boolean))
const pairs = []
for (let i = 0; i < items.length; i++) {
  const a = items[i]
  for (let j = i + 1; j < items.length; j++) {
    const b = items[j]
    // tamanho
    let sz
    if (a.size && b.size) { if (a.size !== b.size) continue; sz = 'igual' } else sz = 'desconhecido'
    const A = a.set, B = b.set
    if (A.size < 2 || B.size < 2) continue
    const inter = [...A].filter((t) => B.has(t)).length
    if (inter < 3) continue
    const cA = clsOf(A), cB = clsOf(B)
    const prim = (s) => new Set([...s].filter((x) => 'SCML'.includes(x)))
    const pA = prim(cA), pB = prim(cB)
    if (pA.size && pB.size && ![...pA].some((x) => pB.has(x))) continue
    if (cA.size && cB.size && ![...cA].some((x) => cB.has(x))) continue
    if ((A.has('facial') && B.has('corporal')) || (A.has('corporal') && B.has('facial'))) continue
    const onlyA = [...A].filter((t) => !B.has(t)), onlyB = [...B].filter((t) => !A.has(t))
    const diff = [...onlyA, ...onlyB]
    if (diff.length > 3) continue
    if (diff.some((t) => DISC.has(t))) continue
    if (diff.some((t) => /\d/.test(t))) continue // fps/numero diferente
    const toneDiff = diff.some((t) => TONE.has(t))
    const swap = onlyA.length && onlyB.length
    let tier
    if (diff.length === 0) tier = 'ALTA'
    else if (toneDiff) tier = 'VARIANTE_COR'
    else if (swap) tier = diff.every(generic) ? 'REVISAR' : 'VARIANTE'
    else tier = diff.every(generic) ? 'MEDIA' : 'REVISAR'
    if (tier === 'VARIANTE' || tier === 'VARIANTE_COR') { pairs.push({ tier, sz, diff, a: fmt(a), b: fmt(b) }); continue }
    // marca incompativel: ambos com marca e marcas diferentes e sem tokens da marca no outro
    pairs.push({ tier, sz, diff, a: fmt(a), b: fmt(b) })
  }
}

// clusters (ALTA + MEDIA + REVISAR) via union-find
const parent = new Map()
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)))
const union = (x, y) => { if (!parent.has(x)) parent.set(x, x); if (!parent.has(y)) parent.set(y, y); parent.set(find(x), find(y)) }
for (const p of pairs.filter((p) => ['ALTA', 'MEDIA'].includes(p.tier))) union(p.a.id, p.b.id)
const groups = new Map()
const byId = new Map(items.map((it) => [it.r.id, fmt(it)]))
for (const id of parent.keys()) { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(byId.get(id)) }
const clusters = [...groups.values()].filter((g) => g.length > 1)

fs.writeFileSync('scripts/dup-audit/pairs.json', JSON.stringify({ pairs, clusters }, null, 1))
const c = {}
for (const p of pairs) c[`${p.tier}/${p.sz}`] = (c[`${p.tier}/${p.sz}`] || 0) + 1
console.log(c, 'clusters ALTA+MEDIA:', clusters.length, 'produtos envolvidos:', clusters.reduce((s, g) => s + g.length, 0))


