import fs from 'node:fs'

const CONSTRUCTOR_KEY = 'key_Xo9yQI2HQ7Rc8HA4'
const CONCURRENCY = 6
const DELAY_MS = 80

const headers = {
  'User-Agent': 'BatistaPriceAudit/2.0 (+internal)',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function brToNum(s) {
  if (s == null) return null
  const n = Number(String(s).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function searchQueryFromName(name) {
  const n = normalizeText(name)
  const drop = new Set([
    'perfume',
    'feminino',
    'masculino',
    'unissex',
    'eau',
    'de',
    'parfum',
    'toilette',
    'colonia',
    'ml',
    'g',
    'kg',
    'com',
    'para',
    'em',
    'gel',
    'creme',
    'locao',
    'oleo',
    'shampoo',
    'condicionador',
    'mascara',
    'capilar',
    'facial',
    'corporal',
  ])
  const tokens = n.split(/\s+/).filter((t) => t.length > 1 && !drop.has(t))
  return tokens.slice(0, 6).join(' ')
}

function overlapScore(a, b) {
  const ta = new Set(normalizeText(a).split(/\s+/).filter(Boolean))
  const tb = new Set(normalizeText(b).split(/\s+/).filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

async function fetchEpoca(gtin) {
  const url = `https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:${encodeURIComponent(gtin)}`
  const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  const row = data?.[0]
  const offer = row?.items?.[0]?.sellers?.[0]?.commertialOffer
  if (!offer?.IsAvailable) return null
  return {
    preco: Number(offer.Price),
    url: `https://www.epocacosmeticos.com.br/${row.linkText}/p`,
  }
}

async function fetchBnw(gtin) {
  const url = `https://belezanaweb.vtexcommercestable.com.br/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:${encodeURIComponent(gtin)}`
  const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } })
  if (!res.ok) return null
  const text = await res.text()
  if (/temporarily unavailable|Access Denied/i.test(text)) return null
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  const row = data?.[0]
  const offer = row?.items?.[0]?.sellers?.[0]?.commertialOffer
  if (!offer?.IsAvailable) return null
  return {
    preco: Number(offer.Price),
    url: `https://www.belezanaweb.com.br/${row.linkText}/p`,
  }
}

function parseSephoraMinPrice(html) {
  // Remove parcelas ("10x de R$ 23,20") para não confundir com preço à vista.
  let cleaned = html.replace(/ou\s+\d+\s*x\s+de\s+R\$\s*[0-9.,]+/gi, ' ')
  cleaned = cleaned.replace(/\d+\s*x\s+de\s+R\$\s*[0-9.,]+/gi, ' ')
  cleaned = cleaned.replace(/\+\s*\d+\s*Pontos/gi, ' ')

  const values = [...cleaned.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)]
    .map((m) => brToNum(m[1]))
    .filter((n) => n != null && n >= 25)

  if (!values.length) return null
  // Na PDP costuma aparecer de/por — pegamos o menor entre os primeiros valores plausíveis.
  return Math.min(...values.slice(0, 8))
}

async function fetchSephora(name, gtin) {
  const queries = [gtin, searchQueryFromName(name), name.split(' ').slice(0, 4).join(' ')]
  let best = null

  for (const q of queries) {
    if (!q || q.length < 3) continue
    const url = `https://ac.cnstrc.com/search/${encodeURIComponent(q)}?key=${CONSTRUCTOR_KEY}&num_results_per_page=8`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) continue
    const data = await res.json()
    for (const r of data?.response?.results || []) {
      const score = overlapScore(name, r.value || '')
      if (!best || score > best.score) {
        best = {
          score,
          url: r.data?.url,
          constructorPrice: r.data?.price != null ? Number(r.data.price) : null,
          title: r.value,
        }
      }
    }
    if (best && best.score >= 0.35) break
    await sleep(60)
  }

  if (!best?.url || best.score < 0.28) return null

  const pdpRes = await fetch(best.url, { headers: { ...headers, Accept: 'text/html' } })
  if (!pdpRes.ok) {
    return best.constructorPrice
      ? { preco: best.constructorPrice, url: best.url, via: 'constructor' }
      : null
  }
  const html = await pdpRes.text()
  const hasGtin = gtin && html.includes(gtin)
  const pdpMin = parseSephoraMinPrice(html)
  const preco = pdpMin ?? best.constructorPrice
  if (!preco) return null
  if (best.score < 0.38 && !hasGtin) return null
  return { preco, url: best.url, via: pdpMin ? 'pdp' : 'constructor', matchScore: best.score, hasGtin }
}

async function mapPool(items, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      out[idx] = await fn(items[idx], idx)
      if (DELAY_MS) await sleep(DELAY_MS)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return out
}

const products = JSON.parse(fs.readFileSync('tmp-active-products.json', 'utf8'))
const rows = []
const stats = {
  ativos: products.length,
  com_epoca: 0,
  com_sephora: 0,
  com_bnw: 0,
  acima_min_concorrente: 0,
}

await mapPool(products, async (p) => {
  const gtin = String(p.gtin || '').trim()
  const loja = Number(p.price)
  if (!gtin || !loja) return

  const [epoca, sephora, bnw] = await Promise.all([
    fetchEpoca(gtin),
    fetchSephora(p.name, gtin),
    fetchBnw(gtin),
  ])

  if (epoca) stats.com_epoca++
  if (sephora) stats.com_sephora++
  if (bnw) stats.com_bnw++

  const competitors = []
  if (epoca) competitors.push({ loja: 'epoca', preco: epoca.preco, url: epoca.url })
  if (sephora) competitors.push({ loja: 'sephora', preco: sephora.preco, url: sephora.url })
  if (bnw) competitors.push({ loja: 'beleza_na_web', preco: bnw.preco, url: bnw.url })

  if (!competitors.length) return

  // Descarta preço Sephora absurdamente baixo (match errado ou lixo de HTML).
  const filtered = competitors.filter(
    (c) => c.loja !== 'sephora' || c.preco >= loja * 0.35 || c.preco >= 40
  )
  if (!filtered.length) return

  const min = filtered.reduce((a, b) => (a.preco <= b.preco ? a : b))
  if (loja <= min.preco + 0.009) return

  stats.acima_min_concorrente++
  rows.push({
    name: p.name,
    slug: p.slug,
    gtin,
    loja_brl: +loja.toFixed(2),
    menor_preco_brl: +min.preco.toFixed(2),
    menor_loja: min.loja,
    diferenca_brl: +(loja - min.preco).toFixed(2),
    pct_acima: +((100 * (loja - min.preco)) / min.preco).toFixed(1),
    epoca_brl: epoca ? +epoca.preco.toFixed(2) : null,
    sephora_brl: sephora ? +sephora.preco.toFixed(2) : null,
    bnw_brl: bnw ? +bnw.preco.toFixed(2) : null,
    urls: {
      batista: `https://www.batistacosmeticos.com.br/produto/${p.slug}`,
      epoca: epoca?.url ?? null,
      sephora: sephora?.url ?? null,
      beleza_na_web: bnw?.url ?? null,
    },
  })
})

rows.sort((a, b) => b.diferenca_brl - a.diferenca_brl)

const report = {
  generated_at: new Date().toISOString(),
  criterio:
    'Produto ativo; preço Batista (tabela) maior que o menor preço encontrado entre Época (VTEX/EAN), Sephora (Constructor+PDP) e Beleza na Web (VTEX/EAN, se disponível).',
  aviso_bnw:
    'Beleza na Web bloqueia acesso automatizado (Akamai) neste ambiente; API VTEX retorna indisponível. Preços BNW entram só se a API responder.',
  stats,
  total_acima: rows.length,
  items: rows,
}

fs.writeFileSync('tmp-precos-acima-3-lojas.json', JSON.stringify(report, null, 2))

const csvHeader =
  'name,slug,gtin,loja_brl,menor_preco_brl,menor_loja,diferenca_brl,epoca_brl,sephora_brl,bnw_brl\n'
const csv =
  csvHeader +
  rows
    .map((r) =>
      [
        JSON.stringify(r.name),
        r.slug,
        r.gtin,
        r.loja_brl,
        r.menor_preco_brl,
        r.menor_loja,
        r.diferenca_brl,
        r.epoca_brl ?? '',
        r.sephora_brl ?? '',
        r.bnw_brl ?? '',
      ].join(',')
    )
    .join('\n')
fs.writeFileSync('tmp-precos-acima-3-lojas.csv', csv)

console.log(JSON.stringify({ stats, total_acima: rows.length, top10: rows.slice(0, 10) }, null, 2))
