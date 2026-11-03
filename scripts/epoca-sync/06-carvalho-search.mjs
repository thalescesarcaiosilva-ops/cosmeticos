// Casa os produtos da loja com a Drogaria Carvalho (sitemap + JSON-LD da página).
// A Carvalho não expõe EAN: o casamento é por slug/nome com checagem de tamanho, tipo e variante.
// Só lê dados: grava cache e relatório CSV, não altera o banco.
import fs from 'node:fs'
import path from 'node:path'
import { CACHE_DIR, ROOT, UA, findSizes, sameProductName, sizeKey, sleep, supa, tokens, typeCompatible } from '../size-enrich/lib.mjs'

const SITE = 'https://drogariacarvalho.com'
const OUT = path.join(CACHE_DIR, 'carvalho-matches.json')
const PAGES = path.join(CACHE_DIR, 'carvalho-pages.json')
const REPORT = path.join(ROOT, 'relatorio-carvalho.csv')
const WORKERS = Number(process.argv.find((a) => a.startsWith('--workers='))?.split('=')[1] || 6)
const FRESH = process.argv.includes('--fresh')
const VARIANT_WORDS = new Set(['lite', 'riche', 'original', 'travel', 'mini', 'refil', 'refill', 'capsule', 'kit', 'infantil', 'kids', 'baby', 'bebe', 'junior', 'men', 'masculino', 'feminino', 'tinted', 'color', 'cor', 'gift', 'estojo', 'combo', 'duo', 'trio', 'leve', 'pague', 'pack'])

async function getText(url, retries = 3) {
  let last
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(30000) })
      if (r.status === 404) return null
      if (r.status === 429) {
        await sleep(3000 * (i + 1))
        continue
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.text()
    } catch (error) {
      last = error
      await sleep(1000 * (i + 1))
    }
  }
  throw last
}

const sizeKeys = (text) => new Set(findSizes(String(text || '')).map((s) => sizeKey(s.label)).filter(Boolean))

function variantConflict(a, b) {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  const out = [...new Set([...ta, ...tb])].filter((t) => VARIANT_WORDS.has(t) && ta.has(t) !== tb.has(t))
  if (/\+/.test(a) !== /\+/.test(b)) out.push('combinado(+)')
  return out
}

const pages = !FRESH && fs.existsSync(PAGES) ? JSON.parse(fs.readFileSync(PAGES, 'utf8')) : {}
async function page(slug) {
  if (pages[slug] !== undefined) return pages[slug]
  const html = await getText(`${SITE}/p/${slug}`)
  let data = null
  for (const m of (html || '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const json = JSON.parse(m[1])
      if (json['@type'] === 'Product') {
        data = {
          name: json.name,
          images: [...new Set([].concat(json.image || []))].slice(0, 6),
          price: Number(json.offers?.price) || null,
          inStock: /InStock/.test(json.offers?.availability || ''),
        }
        break
      }
    } catch {}
  }
  pages[slug] = data
  return data
}

function evaluate(product, cand) {
  const ours = sizeKeys(`${product.name} ${product.size_label || ''}`)
  const theirs = sizeKeys(cand.name)
  const problems = []
  if (ours.size && theirs.size && ![...ours].some((k) => theirs.has(k))) problems.push(`tamanho ${[...ours].join('/')} x ${[...theirs].join('/')}`)
  if (ours.size && !theirs.size) problems.push('sem tamanho na Carvalho')
  if (!ours.size && theirs.size) problems.push('sem tamanho na loja')
  const conflicts = variantConflict(product.name, cand.name)
  if (conflicts.length) problems.push(`variante ${conflicts.join(',')}`)
  if (!typeCompatible(product.name, cand.name)) problems.push('tipo diferente')
  const nameHit = sameProductName({ name: product.name, brand: product.brand }, { productName: cand.name, brand: '' })
  const reverseHit = sameProductName({ name: cand.name, brand: '' }, { productName: `${product.brand} ${product.name}`, brand: product.brand })
  let confidence = null
  if (!problems.length && nameHit && reverseHit) confidence = 'alta'
  else if (!problems.length && (nameHit || reverseHit)) confidence = 'media'
  return { confidence, problems, nameHit, reverseHit }
}

const sitemap = await getText(`${SITE}/sitemap.xml`)
const slugs = [...sitemap.matchAll(/<loc>[^<]*\/p\/([^<]+)<\/loc>/g)].map((m) => decodeURIComponent(m[1]))
const slugSet = new Set(slugs)
const index = new Map()
const slugTokens = new Map()
for (const slug of slugs) {
  const t = [...new Set(tokens(slug.replace(/-/g, ' ')))]
  slugTokens.set(slug, t)
  for (const w of t) {
    if (!index.has(w)) index.set(w, [])
    index.get(w).push(slug)
  }
}
console.log('carvalho', slugs.length)

function candidates(product) {
  const mine = [...new Set(tokens(`${product.brand} ${product.name}`))]
  const rare = mine.filter((w) => index.has(w)).sort((a, b) => index.get(a).length - index.get(b).length).slice(0, 3)
  const scored = new Map()
  for (const w of rare) {
    for (const slug of index.get(w)) {
      if (scored.has(slug)) continue
      const theirs = new Set(slugTokens.get(slug))
      const hits = mine.filter((x) => theirs.has(x)).length
      scored.set(slug, hits / Math.max(mine.length, theirs.size))
    }
  }
  const out = [...scored].filter(([, s]) => s >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([slug]) => slug)
  if (slugSet.has(product.slug)) out.unshift(product.slug)
  return [...new Set(out)]
}

async function searchOne(product) {
  const list = candidates(product)
  if (!list.length) return { status: 'nao_encontrado' }
  const evaluated = []
  for (const slug of list) {
    const data = await page(slug)
    if (!data?.images?.length) continue
    evaluated.push({ slug, ...data, ...evaluate(product, data), exact: slug === product.slug })
    if (evaluated.at(-1).confidence === 'alta') break
  }
  const rank = (c) => (c.confidence === 'alta' ? 20 : c.confidence === 'media' ? 10 : 0) + (c.exact ? 5 : 0)
  evaluated.sort((a, b) => rank(b) - rank(a))
  const best = evaluated[0]
  if (!best?.confidence) {
    return { status: evaluated.length ? 'sem_match' : 'nao_encontrado', notes: evaluated.slice(0, 2).map((c) => `${c.name}${c.problems.length ? ` [${c.problems.join('; ')}]` : ''}`) }
  }
  return {
    status: 'match',
    confidence: best.confidence,
    exactSlug: best.exact,
    slug: best.slug,
    name: best.name,
    images: best.images,
    carvalhoPrice: best.price,
    notes: best.problems,
  }
}

const db = supa()
const [products, brands] = await Promise.all([
  db.select('products?select=id,name,slug,price,original_price,gtin,size_label,brand_id,created_at&order=name.asc'),
  db.select('brands?select=id,name'),
])
const brandName = new Map(brands.map((b) => [b.id, b.name]))
for (const p of products) p.brand = brandName.get(p.brand_id) || ''

const cache = !FRESH && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const queue = products.filter((p) => !cache[p.id] || cache[p.id].status === 'erro')
console.log('produtos', products.length, 'pendentes', queue.length, 'workers', WORKERS)

let done = 0
const total = queue.length
const persist = () => {
  fs.writeFileSync(OUT, JSON.stringify(cache))
  fs.writeFileSync(PAGES, JSON.stringify(pages))
}
async function worker() {
  while (queue.length) {
    const product = queue.shift()
    try {
      cache[product.id] = await searchOne(product)
    } catch (error) {
      cache[product.id] = { status: 'erro', error: error instanceof Error ? error.message : String(error) }
    }
    done += 1
    if (done % 20 === 0) persist()
    if (done % 100 === 0) console.log('feito', done, '/', total)
    await sleep(80)
  }
}
await Promise.all(Array.from({ length: WORKERS }, () => worker()))
persist()

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const lines = [['status', 'confianca', 'slug_igual', 'produto_loja', 'slug_loja', 'criado_em', 'produto_carvalho', 'link_carvalho', 'imagens', 'preco_carvalho', 'observacoes'].join(';')]
const tally = {}
for (const p of products) {
  const rec = cache[p.id]
  if (!rec) continue
  const key = `${rec.status}${rec.confidence ? `/${rec.confidence}` : ''}`
  tally[key] = (tally[key] || 0) + 1
  lines.push(
    [rec.status, rec.confidence, rec.exactSlug ? 'sim' : '', p.name, p.slug, (p.created_at || '').slice(0, 10), rec.name, rec.slug ? `${SITE}/p/${rec.slug}` : '', rec.images?.length, rec.carvalhoPrice, [...(rec.notes || []), rec.error || ''].filter(Boolean).join(' | ')]
      .map(csvCell)
      .join(';')
  )
}
fs.writeFileSync(REPORT, `\uFEFF${lines.join('\n')}`)
console.log(JSON.stringify(tally, null, 2))
console.log('relatorio', REPORT)
