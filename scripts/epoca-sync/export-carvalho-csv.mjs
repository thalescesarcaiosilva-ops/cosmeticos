// Gera CSV dos produtos ativos da Batista que batem com a Drogaria Carvalho.
import fs from 'node:fs'
import path from 'node:path'
import { CACHE_DIR, ROOT } from '../size-enrich/lib.mjs'

const MATCHES = path.join(CACHE_DIR, 'carvalho-matches.json')
const LOCAL = path.join(ROOT, 'scripts/dup-audit/all.json')
const OUT = path.join(ROOT, 'relatorio-carvalho-ativos.csv')

const matches = JSON.parse(fs.readFileSync(MATCHES, 'utf8'))
const all = JSON.parse(fs.readFileSync(LOCAL, 'utf8'))
const byId = Object.fromEntries(all.map((p) => [p.id, p]))

const rows = []
for (const [id, rec] of Object.entries(matches)) {
  if (rec.status !== 'match') continue
  const product = byId[id]
  if (!product?.active) continue
  const carvalhoSlug = rec.carvalhoSlug || (rec.exactSlug ? product.slug : '')
  rows.push({
    product_id: id,
    slug: product.slug,
    nome_batista: product.name,
    nome_carvalho: rec.name || '',
    gtin: product.gtin || '',
    tamanho: product.size_label || '',
    confianca: rec.confidence || '',
    slug_exato: rec.exactSlug ? 'sim' : 'nao',
    qtd_imagens: (rec.images || []).length,
    imagem_1: (rec.images || [])[0] || '',
    imagem_2: (rec.images || [])[1] || '',
    imagem_3: (rec.images || [])[2] || '',
    url_carvalho: carvalhoSlug ? `https://drogariacarvalho.com/p/${carvalhoSlug}` : '',
    preco_carvalho: rec.carvalhoPrice ?? '',
  })
}

rows.sort((a, b) => a.slug.localeCompare(b.slug, 'pt'))

function esc(value) {
  const text = String(value ?? '')
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const cols = Object.keys(rows[0] || { product_id: '' })
const csv = `\uFEFF${cols.join(';')}\n${rows.map((row) => cols.map((col) => esc(row[col])).join(';')).join('\n')}`
fs.writeFileSync(OUT, csv)

const conf = {}
for (const row of rows) conf[row.confianca] = (conf[row.confianca] || 0) + 1
console.log(
  JSON.stringify(
    {
      out: OUT,
      rows: rows.length,
      conf,
      exactSlug: rows.filter((row) => row.slug_exato === 'sim').length,
      altaComImagem: rows.filter((row) => row.confianca === 'alta' && row.qtd_imagens > 0).length,
    },
    null,
    2
  )
)
