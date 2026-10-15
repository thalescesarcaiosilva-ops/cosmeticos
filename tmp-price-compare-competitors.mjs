/**
 * One-off: active store products vs Época (VTEX API by GTIN).
 * Sephora / Beleza na Web require separate integration (not in this script).
 */
import fs from 'node:fs'

const PIX_DISCOUNT_PERCENT = 10 // Batista storefront default; confirm in admin if changed.

function calcPixPrice(price, discountPercent) {
  if (discountPercent <= 0) return price
  return Math.max(price * (1 - discountPercent / 100), 0)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchEpocaByGtin(gtin) {
  const url = `https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:${encodeURIComponent(gtin)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BatistaPriceAudit/1.0 (+internal)' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || !data[0]?.items?.[0]) return null
  const item = data[0].items[0]
  const offer = item.sellers?.[0]?.commertialOffer
  if (!offer?.IsAvailable) return null
  return {
    name: data[0].productName,
    price: Number(offer.Price),
    listPrice: Number(offer.ListPrice),
    url: `https://www.epocacosmeticos.com.br/${data[0].linkText}/p`,
  }
}

const products = JSON.parse(fs.readFileSync('tmp-active-products.json', 'utf8'))
const withGtin = products.filter((p) => p.gtin && String(p.gtin).trim())

const rows = []
const errors = []

for (let i = 0; i < withGtin.length; i++) {
  const p = withGtin[i]
  const gtin = String(p.gtin).trim()
  const loja = Number(p.price)
  const lojaPix = calcPixPrice(loja, PIX_DISCOUNT_PERCENT)

  try {
    const epoca = await fetchEpocaByGtin(gtin)
    if (!epoca?.price) {
      await sleep(120)
      continue
    }
    const minCompetitor = epoca.price
    const acima =
      loja > minCompetitor + 0.009 || lojaPix > minCompetitor + 0.009

    if (acima) {
      rows.push({
        name: p.name,
        slug: p.slug,
        gtin,
        loja_brl: +loja.toFixed(2),
        loja_pix_brl: +lojaPix.toFixed(2),
        epoca_brl: +epoca.price.toFixed(2),
        diff_loja_vs_epoca: +(loja - epoca.price).toFixed(2),
        diff_pix_vs_epoca: +(lojaPix - epoca.price).toFixed(2),
        pct_loja_vs_epoca: +((100 * (loja - epoca.price)) / epoca.price).toFixed(1),
        epoca_url: epoca.url,
      })
    }
  } catch (e) {
    errors.push({ gtin, message: String(e?.message || e) })
  }

  if ((i + 1) % 25 === 0) {
    process.stderr.write(`checked ${i + 1}/${withGtin.length}\n`)
  }
  await sleep(150)
}

rows.sort((a, b) => b.diff_loja_vs_epoca - a.diff_loja_vs_epoca)

const report = {
  generated_at: new Date().toISOString(),
  criterio:
    'Produto ativo com GTIN; preço Batista (tabela ou Pix 10%) maior que preço atual Época Cosméticos (VTEX).',
  limitacoes: [
    'Sephora e Beleza na Web não consultados neste script (sem API estável por GTIN no projeto).',
    'Confirme desconto Pix real no admin se diferente de 10%.',
  ],
  ativos_total: products.length,
  ativos_com_gtin: withGtin.length,
  acima_epoca: rows.length,
  erros: errors.length,
  items: rows,
}

fs.writeFileSync('tmp-precos-acima-concorrentes.json', JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      acima_epoca: rows.length,
      amostra: rows.slice(0, 20),
      monsieur: rows.find((r) => r.gtin === '3614271716156') || null,
    },
    null,
    2
  )
)
