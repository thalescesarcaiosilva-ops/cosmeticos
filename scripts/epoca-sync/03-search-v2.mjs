// Busca cada produto na Época por todas as variantes de GTIN + nome.
// Prefere o anúncio vendido pela Época; senão usa um único outro vendedor.
// Só lê dados: grava cache e relatório CSV, não altera o banco.
import fs from 'node:fs'
import path from 'node:path'
import {
  CACHE_DIR,
  ROOT,
  findSizes,
  getJson,
  norm,
  sameProductName,
  sizeKey,
  sleep,
  supa,
  tokens,
  typeCompatible,
} from '../size-enrich/lib.mjs'

const OUT = path.join(CACHE_DIR, 'epoca-market-v2.json')
const OLD = path.join(CACHE_DIR, 'epoca-seller-matches.json')
const REPORT = path.join(ROOT, 'relatorio-epoca-v2.csv')
const BASE = 'https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search'
const SELLER = 'epoca cosmeticos'
const STRICT_FROM = '2026-10-14'
const SALE_FACTOR = 0.67
const LIST_FACTOR = 1.38
const WORKERS = Number(process.argv.find((a) => a.startsWith('--workers='))?.split('=')[1] || 5)
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const FRESH = process.argv.includes('--fresh')

const VARIANT_WORDS = new Set(['lite', 'riche', 'original', 'travel', 'mini', 'refil', 'refill', 'capsule', 'kit', 'infantil', 'kids', 'baby', 'bebe', 'junior', 'men', 'masculino', 'feminino', 'tinted', 'color', 'cor', 'gift', 'estojo', 'combo', 'duo', 'trio'])

function checkDigit(body) {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i])
    sum += i % 2 === 0 ? n * 3 : n
  }
  return String((10 - (sum % 10)) % 10)
}

function validGtin(d) {
  return d.length >= 8 && d.length <= 14 && checkDigit(d.slice(0, -1)) === d.slice(-1)
}

function gtinCore(g) {
  const d = String(g || '').replace(/\D/g, '')
  const options = [d, d.replace(/^0+/, ''), d.slice(0, -1), d.slice(0, 13)]
  const ok = options.find((x) => x && validGtin(x))
  if (!ok) return null
  const body = ok.slice(0, -1)
  return (body.length === 13 ? body.slice(1) : body).replace(/^0+/, '')
}

function gtinVariants(g) {
  const core = gtinCore(g)
  if (!core) return []
  const set = new Set()
  const c12 = core.padStart(12, '0')
  set.add(c12 + checkDigit(c12))
  set.add((c12 + checkDigit(c12)).replace(/^0+/, ''))
  for (let ind = 0; ind <= 9; ind++) {
    const body = `${ind}${c12}`
    set.add(body + checkDigit(body))
  }
  return [...set].filter((e) => e.length >= 8)
}

function sizeKeys(text) {
  const keys = new Set()
  for (const size of findSizes(String(text || ''))) {
    const key = sizeKey(size.label)
    if (key) keys.add(key)
  }
  return keys
}

function itemSizes(product, item) {
  const keys = new Set()
  for (const chunk of [item?.name, item?.nameComplete, ...(item?.['tamanho sku'] || []), ...(product?.Tamanho || [])]) {
    for (const key of sizeKeys(chunk)) keys.add(key)
  }
  return keys
}

function overlap(a, b) {
  const left = tokens(a)
  const right = new Set(tokens(b))
  if (!left.length) return 0
  return left.filter((t) => right.has(t)).length / left.length
}

function variantConflict(a, b) {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  const out = [...new Set([...ta, ...tb])].filter((t) => VARIANT_WORDS.has(t) && ta.has(t) !== tb.has(t))
  if (/\+/.test(a) !== /\+/.test(b)) out.push('combinado(+)')
  return out
}

function offers(item) {
  const out = []
  for (const seller of item?.sellers || []) {
    const offer = seller.commertialOffer || {}
    const price = Number(offer.Price)
    if (offer.IsAvailable && Number.isFinite(price) && price > 0) {
      out.push({ seller: seller.sellerName, price, epoca: norm(seller.sellerName) === SELLER })
    }
  }
  return out
}

function imageUrls(item) {
  const seen = new Set()
  const urls = []
  for (const image of item?.images || []) {
    const raw = image?.imageUrl
    if (!raw) continue
    const id = /\/ids\/(\d+)/.exec(raw)?.[1] || raw
    if (seen.has(id)) continue
    seen.add(id)
    urls.push(raw.replace(/\/ids\/(\d+)[^/]*\//, '/ids/$1-1000-1000/'))
    if (urls.length >= 6) break
  }
  return urls
}

function evaluate(product, epocaProduct, item) {
  const itemName = item.nameComplete || item.name || epocaProduct.productName
  const ours = sizeKeys(`${product.name} ${product.size_label || ''}`)
  const theirs = itemSizes(epocaProduct, item)
  const eanHit = !!product.core && gtinCore(item.ean) === product.core
  const nameHit =
    sameProductName({ name: product.name, brand: product.brand }, { productName: itemName, brand: epocaProduct.brand }) &&
    typeCompatible(product.name, itemName)
  const ratio = overlap(product.name, itemName)
  const sizeBoth = ours.size > 0 && theirs.size > 0
  const sizeOk = sizeBoth ? [...ours].some((k) => theirs.has(k)) : ours.size === 0 && theirs.size === 0
  const conflicts = variantConflict(product.name, itemName)
  const typeOk = typeCompatible(product.name, itemName)

  const problems = []
  if (sizeBoth && !sizeOk) problems.push(`tamanho ${[...ours].join('/')} x ${[...theirs].join('/')}`)
  if (conflicts.length) problems.push(`variante ${conflicts.join(',')}`)
  if (!typeOk) problems.push('tipo diferente')

  let confidence = null
  if (eanHit && !problems.length && (nameHit || ratio >= 0.45)) confidence = 'alta'
  else if (eanHit && !problems.length) confidence = 'media'
  else if (nameHit && sizeOk && !problems.length) confidence = sizeBoth ? 'alta' : 'media'

  return { itemName, eanHit, nameHit, ratio, sizeOk, sizeBoth, problems, confidence, item, epocaProduct }
}

function choose(product, rows) {
  const seenItems = new Set()
  const candidates = []
  for (const epocaProduct of rows) {
    for (const item of epocaProduct.items || []) {
      if (seenItems.has(item.itemId)) continue
      seenItems.add(item.itemId)
      const ev = evaluate(product, epocaProduct, item)
      ev.offers = offers(item)
      candidates.push(ev)
    }
  }
  const usable = candidates.filter((c) => c.confidence && c.offers.length)
  if (!usable.length) {
    const near = candidates.filter((c) => c.eanHit || c.nameHit)
    return {
      status: near.length ? (near.some((c) => c.offers.length) ? 'conflito' : 'sem_estoque') : rows.length ? 'sem_match' : 'nao_encontrado',
      notes: near.slice(0, 3).map((c) => `${c.itemName}${c.problems.length ? ` [${c.problems.join('; ')}]` : ''}`),
    }
  }
  const rank = (c) => (c.confidence === 'alta' ? 2 : 1) * 10 + (c.eanHit ? 3 : 0) + c.ratio
  const epocaOnes = usable.filter((c) => c.offers.some((o) => o.epoca))
  const pool = epocaOnes.length ? epocaOnes : usable
  pool.sort((a, b) => rank(b) - rank(a))
  const best = pool[0]
  const offer = epocaOnes.length
    ? best.offers.find((o) => o.epoca)
    : best.offers.slice().sort((a, b) => a.price - b.price)[0]
  const imageSource = epocaOnes.length ? best : usable.slice().sort((a, b) => rank(b) - rank(a))[0]
  return {
    status: 'match',
    confidence: best.confidence,
    via: best.eanHit ? 'ean' : 'nome',
    seller: offer.seller,
    epocaSeller: offer.epoca,
    basePrice: offer.price,
    newPrice: Math.round(offer.price * SALE_FACTOR * 100) / 100,
    listPrice: Math.round(offer.price * LIST_FACTOR * 100) / 100,
    itemName: best.itemName,
    ean: best.item.ean,
    link: best.epocaProduct.link,
    images: imageUrls(imageSource.item),
  }
}

async function byEan(gtin) {
  const variants = gtinVariants(gtin)
  if (!variants.length) return []
  const fq = variants.map((v) => `alternateIds_Ean:${v}`).join(',')
  const r = await getJson(`${BASE}?fq=${encodeURIComponent(fq)}&_from=0&_to=19`)
  return Array.isArray(r) ? r : []
}

function inferCore(product, rows) {
  const cores = new Set()
  for (const epocaProduct of rows) {
    for (const item of epocaProduct.items || []) {
      const ev = evaluate(product, epocaProduct, item)
      const core = gtinCore(item.ean)
      if (core && ev.nameHit && ev.sizeBoth && ev.sizeOk && !ev.problems.length) cores.add(core)
    }
  }
  return cores.size === 1 ? [...cores][0] : null
}

async function searchOne(product) {
  const rows = await byEan(product.gtin)
  const query = norm(product.name).slice(0, 120)
  if (query) {
    const r = await getJson(`${BASE}?ft=${encodeURIComponent(query)}&_from=0&_to=9`)
    if (Array.isArray(r)) rows.push(...r)
  }
  const storeEanFound = product.core && rows.some((p) => (p.items || []).some((i) => gtinCore(i.ean) === product.core))
  if (!storeEanFound) {
    const core = inferCore(product, rows)
    if (core && core !== product.core) {
      product.core = core
      product.inferredCore = true
      rows.push(...(await byEan(core.padStart(12, '0') + checkDigit(core.padStart(12, '0')))))
    }
  }
  let rec = choose(product, rows)
  if (rec.status !== 'match') {
    const short = norm(`${product.brand} ${product.name}`).split(' ').filter((t, i, all) => all.indexOf(t) === i).slice(0, 7).join(' ')
    if (short && short !== query) {
      const r = await getJson(`${BASE}?ft=${encodeURIComponent(short)}&_from=0&_to=9`)
      if (Array.isArray(r) && r.length) {
        rows.push(...r)
        rec = choose(product, rows)
      }
    }
  }
  if (product.inferredCore) rec.gtinInferido = product.core
  return rec
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const db = supa()
const [products, brands] = await Promise.all([
  db.select('products?select=id,name,slug,price,original_price,gtin,size_label,brand_id,created_at,active&order=name.asc'),
  db.select('brands?select=id,name'),
])
const brandName = new Map(brands.map((b) => [b.id, b.name]))
for (const p of products) {
  p.brand = brandName.get(p.brand_id) || ''
  p.core = gtinCore(p.gtin)
  p.strict = (p.created_at || '') >= STRICT_FROM
}

const cache = !FRESH && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
let queue = products.filter((p) => !cache[p.id] || cache[p.id].status === 'erro')
if (ONLY) queue = queue.filter((p) => p.slug === ONLY)
console.log('produtos', products.length, 'pendentes', queue.length, 'workers', WORKERS)

let done = 0
const total = queue.length
async function worker() {
  while (queue.length) {
    const product = queue.shift()
    let rec
    try {
      rec = await searchOne(product)
    } catch (error) {
      rec = { status: 'erro', error: error instanceof Error ? error.message : String(error) }
    }
    cache[product.id] = rec
    done += 1
    if (done % 10 === 0) fs.writeFileSync(OUT, JSON.stringify(cache))
    if (done % 100 === 0) console.log('feito', done, '/', total)
    await sleep(120)
  }
}
await Promise.all(Array.from({ length: WORKERS }, () => worker()))
fs.writeFileSync(OUT, JSON.stringify(cache))

const old = fs.existsSync(OLD) ? JSON.parse(fs.readFileSync(OLD, 'utf8')) : {}
const header = [
  'grupo', 'acao', 'status', 'confianca', 'via', 'vendedor', 'produto_loja', 'slug', 'gtin_loja',
  'preco_atual', 'preco_riscado_atual', 'preco_base', 'preco_novo', 'preco_riscado_novo',
  'anuncio_encontrado', 'ean_encontrado', 'imagens', 'link', 'aplicado_antes', 'auditoria_antes', 'observacoes',
]
const lines = [header.join(';')]
const tally = {}
for (const p of products) {
  const rec = cache[p.id]
  if (!rec) continue
  const prev = old[p.id]
  const group = p.strict ? 'recente' : 'antigo'
  let action = 'nada'
  if (rec.status === 'match') {
    const replaceImages = p.strict && rec.confidence === 'alta' && rec.images.length > 0
    action = replaceImages ? 'preco+imagens' : 'so_preco'
    if (rec.confidence !== 'alta') action = 'revisar'
  } else if (rec.status === 'conflito') action = 'revisar'
  let audit = ''
  if (prev?.applied) {
    if (rec.status !== 'match') audit = 'SUSPEITO: v2 nao confirma'
    else if (prev.itemName && prev.itemName !== rec.itemName) audit = `anuncio diferente: antes ${prev.itemName}`
    else audit = 'ok'
  }
  const key = `${group}|${action}`
  tally[key] = (tally[key] || 0) + 1
  lines.push(
    [
      group, action, rec.status, rec.confidence, rec.via, rec.seller, p.name, p.slug, p.gtin,
      p.price, p.original_price, rec.basePrice, rec.newPrice, rec.listPrice,
      rec.itemName, rec.ean, rec.images?.length, rec.link ? `https://www.epocacosmeticos.com.br${rec.link.replace(/^https?:\/\/[^/]+/, '')}` : '',
      prev?.applied ? 'sim' : '', audit,
      [rec.gtinInferido ? `gtin inferido ${rec.gtinInferido}` : '', ...(rec.notes || []), rec.error || ''].filter(Boolean).join(' | '),
    ].map(csvCell).join(';')
  )
}
fs.writeFileSync(REPORT, `\uFEFF${lines.join('\n')}`)
console.log(JSON.stringify(tally, null, 2))
const sellerTally = {}
for (const rec of Object.values(cache)) if (rec.status === 'match') sellerTally[rec.epocaSeller ? 'epoca' : 'outro'] = (sellerTally[rec.epocaSeller ? 'epoca' : 'outro'] || 0) + 1
console.log('vendedor', JSON.stringify(sellerTally))
console.log('relatorio', REPORT)
