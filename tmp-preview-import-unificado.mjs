import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function parseCSV(input) {
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (q) {
      if (c === '"' && input[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

function normalizeKey(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeProductName(s) {
  let n = normalizeKey(s)
  n = n.replace(/\b(eau de parfum|eau de toilette|edp|edt|refil|refill)\b/g, ' ')
  n = n.replace(/\b\d+\s*(ml|g|kg|un|und|caps|comp|sache|saches|unidades)\b/g, ' ')
  return n.replace(/\s+/g, ' ').trim()
}

function tokenSetRatio(a, b) {
  const ta = new Set(a.split(' ').filter((t) => t.length > 1))
  const tb = new Set(b.split(' ').filter((t) => t.length > 1))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

function parsePrice(v) {
  const n = parseFloat(String(v || '').replace(',', '.').trim())
  return Number.isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100
}

const uniText = fs
  .readFileSync('faltantes_unificado_woocommerce_20261014_085613.csv', 'utf8')
  .replace(/^\uFEFF/, '')
const uniRows = parseCSV(uniText)
const uniHdr = uniRows[0]
const ui = (n) => uniHdr.indexOf(n)
const uni = uniRows
  .slice(1)
  .filter((r) => r.length > 1 && (r[ui('Nome')] || '').trim())
  .map((r) => ({
    nome: r[ui('Nome')].trim(),
    sku: (r[ui('SKU')] || '').trim(),
    gtin: (r[ui('GTIN, UPC, EAN, or ISBN')] || '').trim(),
    preco: parsePrice(r[ui('Preço')]),
    promo: parsePrice(r[ui('Preço promocional')]),
    cats: (r[ui('Categorias')] || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    brand: (r[ui('Brands')] || '').trim(),
    imagens: (r[ui('Imagens')] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean).length,
  }))

const faltText = fs.readFileSync('produtos-faltantes-farmacia.csv', 'utf8').replace(/^\uFEFF/, '')
const faltRows = parseCSV(faltText)
const faltHdr = faltRows[0]
const fi = (n) => faltHdr.indexOf(n)
const falt = faltRows
  .slice(1)
  .filter((r) => r.length > 1 && (r[fi('nome')] || '').trim())
  .map((r) => ({
    nome: r[fi('nome')].trim(),
    sku: (r[fi('sku')] || '').trim(),
    gtin: (r[fi('gtin')] || '').trim(),
    preco: parsePrice(r[fi('preco')]),
    categoria: r[fi('categoria_principal')] || '',
  }))

const env = fs.readFileSync('.env.local', 'utf8')
const sb = createClient(
  env.match(/SUPABASE_URL=(.+)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim(),
)

const store = []
let from = 0
while (true) {
  const { data, error } = await sb
    .from('products')
    .select(
      'id,name,slug,sku,gtin,price,active,categories!products_category_id_fkey(name)',
    )
    .range(from, from + 999)
  if (error) throw error
  if (!data?.length) break
  for (const p of data) store.push({ ...p, category: p.categories?.name || null })
  if (data.length < 1000) break
  from += 1000
}

const catsStore = (await sb.from('categories').select('name')).data.map((c) => c.name)

function findMatch(item, pool) {
  const sku = normalizeKey(item.sku)
  if (sku) {
    const hit = pool.find((p) => normalizeKey(p.sku) === sku)
    if (hit) return { how: 'sku', item: hit }
  }
  const gtin = normalizeKey(item.gtin)
  if (gtin) {
    const hit = pool.find((p) => normalizeKey(p.gtin) === gtin)
    if (hit) return { how: 'gtin', item: hit }
  }
  const nn = normalizeProductName(item.nome)
  let best = null
  let bestScore = 0
  for (const p of pool) {
    const pn = normalizeProductName(p.nome || p.name)
    if (pn === nn) return { how: 'name_exact', item: p }
    const score = tokenSetRatio(nn, pn)
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  if (best && bestScore >= 0.85)
    return { how: `name_fuzzy_${Math.round(bestScore * 100)}`, item: best, score: bestScore }
  return null
}

const covered = []
const notInFaltantes = []
const faltCovered = new Set()

for (const u of uni) {
  const m = findMatch(u, falt)
  if (m) {
    covered.push({
      uni: u.nome,
      falt: m.item.nome,
      how: m.how,
      uniPrice: u.preco,
      faltPrice: m.item.preco,
      cats: u.cats,
    })
    faltCovered.add(m.item.nome)
  } else {
    notInFaltantes.push(u)
  }
}
const stillMissing = falt.filter((f) => !faltCovered.has(f.nome))

const alreadyInStore = []
const trulyNew = []
for (const u of uni) {
  const m = findMatch(
    u,
    store.map((p) => ({
      nome: p.name,
      sku: p.sku,
      gtin: p.gtin,
      name: p.name,
      active: p.active,
      price: p.price,
      category: p.category,
    })),
  )
  if (m)
    alreadyInStore.push({
      uni: u.nome,
      store: m.item.name,
      how: m.how,
      active: m.item.active,
    })
  else trulyNew.push(u)
}

const newCats = {}
for (const u of trulyNew) {
  for (const c of u.cats.length ? u.cats : ['(sem)']) {
    newCats[c] = (newCats[c] || 0) + 1
  }
}
const storeCatSet = new Set(catsStore.map(normalizeKey))
const catsNotInStore = [
  ...new Set(trulyNew.flatMap((u) => u.cats)),
].filter((c) => !storeCatSet.has(normalizeKey(c)))

const stillByCat = {}
for (const f of stillMissing) {
  stillByCat[f.categoria] = (stillByCat[f.categoria] || 0) + 1
}

const activeNow = store.filter((p) => p.active).length

const report = {
  uniTotal: uni.length,
  faltantesFarmaciaTotal: falt.length,
  coberturaDosFaltantes: {
    cobertos: covered.length,
    aindaFaltam: stillMissing.length,
    pctCobertura: Math.round((covered.length / falt.length) * 1000) / 10,
  },
  unificadoVsLoja: {
    jaExistemNaLoja: alreadyInStore.length,
    novosDeVerdade: trulyNew.length,
    jaAtivos: alreadyInStore.filter((x) => x.active).length,
    jaInativos: alreadyInStore.filter((x) => !x.active).length,
  },
  projecaoLoja: {
    ativosHoje: activeNow,
    totalHoje: store.length,
    novosImportados: trulyNew.length,
    ativosAposImport: activeNow + trulyNew.length,
    totalAposImport: store.length + trulyNew.length,
  },
  categoriasNovasNoCsv: catsNotInStore,
  novosPorCategoria: Object.entries(newCats)
    .map(([c, n]) => ({ c, n }))
    .sort((a, b) => b.n - a.n),
  aindaFaltamPorCategoria: Object.entries(stillByCat)
    .map(([c, n]) => ({ c, n }))
    .sort((a, b) => b.n - a.n),
  amostraCobertos: covered.slice(0, 8).map((x) => ({
    uni: x.uni,
    falt: x.falt,
    how: x.how,
    precoUni: x.uniPrice,
    precoFalt: x.faltPrice,
  })),
  amostraAindaFaltam: stillMissing.slice(0, 25).map((f) => ({
    nome: f.nome,
    cat: f.categoria,
    preco: f.preco,
  })),
  amostraJaNaLoja: alreadyInStore.slice(0, 10).map((x) => ({
    uni: x.uni,
    store: x.store,
    how: x.how,
    active: x.active,
  })),
  amostraForaDoFaltantes: notInFaltantes.slice(0, 20).map((u) => ({
    nome: u.nome,
    cats: u.cats,
    preco: u.preco,
  })),
  semImagem: uni.filter((u) => u.imagens === 0).length,
  semPreco: uni.filter((u) => u.preco == null).length,
  comGtin: uni.filter((u) => u.gtin).length,
}

fs.writeFileSync(
  'tmp-preview-import-unificado.json',
  JSON.stringify(
    {
      ...report,
      stillMissingAll: stillMissing.map((f) => ({
        nome: f.nome,
        cat: f.categoria,
        sku: f.sku,
        preco: f.preco,
      })),
      coveredAll: covered,
      trulyNewAll: trulyNew.map((u) => ({
        nome: u.nome,
        sku: u.sku,
        cats: u.cats,
        preco: u.preco,
        brand: u.brand,
      })),
    },
    null,
    2,
  ),
)

console.log(JSON.stringify(report, null, 2))
