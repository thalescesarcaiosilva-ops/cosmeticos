// Resume o relatorio-epoca-v2.csv: contagens, auditoria e amostras para conferência.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from '../size-enrich/lib.mjs'

const text = fs.readFileSync(path.join(ROOT, 'relatorio-epoca-v2.csv'), 'utf8').replace(/^\uFEFF/, '')
const lines = text.split('\n')
const header = lines[0].split(';')

function parse(line) {
  const out = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') (cell += '"'), i++
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ';') out.push(cell), (cell = '')
    else cell += ch
  }
  out.push(cell)
  return Object.fromEntries(header.map((k, i) => [k, out[i] ?? '']))
}

export const rows = lines.slice(1).filter(Boolean).map(parse)

if (process.argv[1].endsWith('04-analyze.mjs')) {
  const count = (fn) => {
    const m = {}
    for (const r of rows) {
      const k = fn(r)
      if (k) m[k] = (m[k] || 0) + 1
    }
    return m
  }
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
  const show = (title, list, fn) => {
    console.log(`--- ${title} (${list.length})`)
    for (const r of list) console.log(fn(r))
  }
  console.log('status por grupo', count((r) => `${r.grupo}|${r.status}`))
  console.log('auditoria 412', count((r) => (r.aplicado_antes ? r.auditoria_antes.split(':')[0] : '')))
  console.log('via/confianca', count((r) => (r.status === 'match' ? `${r.via}|${r.confianca}` : '')))
  const match = rows.filter((r) => r.status === 'match')
  const ratio = match.map((r) => Number(r.preco_novo) / Number(r.preco_atual)).filter(Number.isFinite).sort((a, b) => a - b)
  const q = (p) => ratio[Math.floor(ratio.length * p)].toFixed(2)
  console.log('preco novo / atual  p10', q(0.1), 'p50', q(0.5), 'p90', q(0.9))
  console.log('gtin inferido', rows.filter((r) => /inferido/.test(r.observacoes)).length)
  const fmt = (r) => `${r.produto_loja}  =>  ${r.anuncio_encontrado}  [${r.vendedor} ${r.preco_base}]`
  show('imagens via nome', shuffle(match.filter((r) => r.acao === 'preco+imagens' && r.via === 'nome')).slice(0, 15), fmt)
  show('imagens via ean', shuffle(match.filter((r) => r.acao === 'preco+imagens' && r.via === 'ean')).slice(0, 15), fmt)
  show('antigos so preco', shuffle(match.filter((r) => r.grupo === 'antigo')).slice(0, 8), fmt)
  show('412 suspeitos', rows.filter((r) => /SUSPEITO|diferente/.test(r.auditoria_antes)).slice(0, 15), (r) => `${r.produto_loja}  ||  ${r.auditoria_antes}  ||  ${r.observacoes.slice(0, 140)}`)
  show('conflitos recentes', shuffle(rows.filter((r) => r.grupo === 'recente' && r.status === 'conflito')).slice(0, 10), (r) => `${r.produto_loja}  ||  ${r.observacoes.slice(0, 160)}`)
  show('maiores quedas', match.slice().sort((a, b) => a.preco_novo / a.preco_atual - b.preco_novo / b.preco_atual).slice(0, 8), (r) => `${r.preco_atual} -> ${r.preco_novo}  ${fmt(r)}`)
  show('maiores altas', match.slice().sort((a, b) => b.preco_novo / b.preco_atual - a.preco_novo / a.preco_atual).slice(0, 8), (r) => `${r.preco_atual} -> ${r.preco_novo}  ${fmt(r)}`)
}
