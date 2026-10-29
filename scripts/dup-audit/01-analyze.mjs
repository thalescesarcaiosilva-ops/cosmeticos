// Auditoria de produtos duplicados (somente leitura). Gera scripts/dup-audit/result.json
import fs from 'node:fs'
import { norm, findSizes, sizeKey, strip } from '../size-enrich/lib.mjs'

const all = JSON.parse(fs.readFileSync('scripts/dup-audit/all.json', 'utf8'))
const brandOf = (r) => (Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name) || ''
const catOf = (r) => (Array.isArray(r.category) ? r.category[0]?.name : r.category?.name) || ''

const STOP = new Set('de da do das dos e com para em o a os as um uma the by of and ml g gr kg l un und unidade unidades'.split(' '))
// sinonimos / ruido
const SYN = { oil: 'oleo', hair: 'capilar', capilares: 'capilar', cabelos: 'capilar', cabelo: 'capilar', shampoos: 'shampoo', xampu: 'shampoo', sampoo: 'shampoo', conditioner: 'condicionador', mask: 'mascara', masque: 'mascara', cream: 'creme', serum: 'serum', facial: 'facial', hidratante: 'hidratante', professional: 'profissional', original: 'original', premium: 'premium', 'tratamento': 'tratamento' }
const NOISE = new Set('capilar original profissional professional novo nova nutritivo nutritiva hidratante tratamento'.split(' '))
// palavras que indicam formato/produto diferente quando so de um lado
const DISC = new Set('refil refill kit mini travel trio duo combo sache recarga spray mousse espuma sabonete barra liquido liquida'.split(' '))

function effSize(r) {
  if (r.size_label) return sizeKey(r.size_label.replace(/\s+/g, ' ').trim().toUpperCase()) || r.size_label
  const s = findSizes(r.name)
  if (s.length === 1) return sizeKey(s[0].label)
  if (s.length > 1) return 'multi:' + s.map((x) => sizeKey(x.label)).sort().join('+')
  return null
}

function coreTokens(r) {
  const bt = new Set(norm(brandOf(r)).split(' ').filter(Boolean))
  let n = norm(r.name)
  // remove tamanhos do nome
  n = n.replace(/(?<![\w.])\d{1,4}(?:\.\d{1,2})?\s*(ml|mililitros?|gr|gramas?|g|kg|mg|l|litros?|oz)(?![a-z0-9])/g, ' ')
  const toks = n.split(' ').filter(Boolean).map((t) => SYN[t] || t)
  return toks.filter((t) => !STOP.has(t) && !bt.has(t))
}

const price = (r) => Number(r.price)
const img = (r) => (r.images && r.images[0]) || null

const active = all.filter((r) => r.active)
const items = active.map((r) => {
  const toks = coreTokens(r)
  return { r, brand: norm(brandOf(r)), size: effSize(r), toks, set: new Set(toks), key: [...new Set(toks)].sort().join(' '),
    keyLoose: [...new Set(toks.filter((t) => !NOISE.has(t)))].sort().join(' ') }
})

const fmt = (it) => ({ id: it.r.id, name: it.r.name, slug: it.r.slug, brand: brandOf(it.r), cat: catOf(it.r), price: price(it.r), stock: it.r.stock, sku: it.r.sku, gtin: it.r.gtin, size: it.size, img: img(it.r), woo: it.r.woocommerce_id, created: it.r.created_at })

const result = { totals: { all: all.length, active: active.length } }

// ---- A: GTIN igual
const groupBy = (arr, f) => {
  const m = new Map()
  for (const x of arr) { const k = f(x); if (k == null || k === '') continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x) }
  return [...m.entries()].filter(([, v]) => v.length > 1)
}
const validGtin = (g) => g && /^\d{8,14}$/.test(g.trim()) && !/^(0+|1+)$/.test(g.trim())
result.gtin = groupBy(items, (it) => (validGtin(it.r.gtin) ? it.r.gtin.trim().replace(/^0+/, '') : null)).map(([k, v]) => ({ key: k, items: v.map(fmt) }))
result.gtinInvalid = items.filter((it) => it.r.gtin && !validGtin(it.r.gtin)).length
// ---- B: SKU igual
result.sku = groupBy(items, (it) => (it.r.sku ? it.r.sku.trim().toLowerCase() : null)).map(([k, v]) => ({ key: k, items: v.map(fmt) }))
// ---- C: slug / nome identicos
result.nameExact = groupBy(items, (it) => norm(it.r.name)).map(([k, v]) => ({ key: k, items: v.map(fmt) }))
// ---- G: mesma imagem
result.image = groupBy(items, (it) => img(it.r)).map(([k, v]) => ({ key: k, items: v.map(fmt) }))

// ---- D: nucleo igual (marca + tokens) -> mesmo tamanho / tamanho diferente / desconhecido
const pairSeen = new Set()
const pairs = []
const byBrand = new Map()
for (const it of items) { const k = it.brand || '(sem marca)'; if (!byBrand.has(k)) byBrand.set(k, []); byBrand.get(k).push(it) }

function classify(a, b) {
  // retorna {score, reason} ou null
  if (a.r.id === b.r.id) return null
  const A = a.set, B = b.set
  if (!A.size || !B.size) return null
  const aKit = [...A].some((t) => DISC.has(t)), bKit = [...B].some((t) => DISC.has(t))
  const discA = [...A].filter((t) => DISC.has(t) && !B.has(t)), discB = [...B].filter((t) => DISC.has(t) && !A.has(t))
  if (discA.length || discB.length) return null
  // numeros (fps, tom, cor) precisam ser iguais
  const numA = [...A].filter((t) => /\d/.test(t)).sort().join(','), numB = [...B].filter((t) => /\d/.test(t)).sort().join(',')
  if (numA !== numB) return null
  const inter = [...A].filter((t) => B.has(t)).length
  const union = new Set([...A, ...B]).size
  const jac = inter / union
  const small = A.size <= B.size ? A : B, big = A.size <= B.size ? B : A
  const contained = [...small].every((t) => big.has(t))
  const extra = big.size - small.size
  let kind = null
  if (a.key === b.key) kind = 'nucleo-identico'
  else if (a.keyLoose === b.keyLoose && a.keyLoose) kind = 'nucleo-identico-sem-ruido'
  else if (contained && extra <= 2 && small.size >= 2) kind = `contido(+${extra})`
  else if (jac >= 0.8 && small.size >= 3) kind = `similar(${jac.toFixed(2)})`
  if (!kind) return null
  let sz
  if (a.size && b.size) sz = a.size === b.size ? 'mesmo-tamanho' : 'tamanho-diferente'
  else sz = 'tamanho-desconhecido'
  return { kind, sz, jac }
}

for (const [brand, list] of byBrand) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const c = classify(list[i], list[j])
    if (!c) continue
    pairs.push({ ...c, a: fmt(list[i]), b: fmt(list[j]) })
  }
}
result.pairs = pairs

// ---- E: mesmo nucleo entre marcas diferentes (marca digitada diferente / sem marca)
const noBrandish = items.filter((it) => !it.brand)
result.noBrand = noBrandish.length

// ---- H: marca escrita de formas diferentes
const brandNames = [...new Set(active.map(brandOf))].filter(Boolean)
const bk = new Map()
for (const b of brandNames) { const k = norm(b).replace(/ /g, ''); if (!bk.has(k)) bk.set(k, []); bk.get(k).push(b) }
result.brandVariants = [...bk.values()].filter((v) => v.length > 1)

fs.writeFileSync('scripts/dup-audit/result.json', JSON.stringify(result, null, 1))
const cnt = (f) => pairs.filter(f).length
console.log({
  ...result.totals, gtinGroups: result.gtin.length, gtinInvalid: result.gtinInvalid, skuGroups: result.sku.length,
  nameExactGroups: result.nameExact.length, imageGroups: result.image.length, noBrand: result.noBrand, brandVariants: result.brandVariants.length,
  pairsTotal: pairs.length,
  mesmoTam: cnt((p) => p.sz === 'mesmo-tamanho'), tamDif: cnt((p) => p.sz === 'tamanho-diferente'), tamDesc: cnt((p) => p.sz === 'tamanho-desconhecido'),
})
