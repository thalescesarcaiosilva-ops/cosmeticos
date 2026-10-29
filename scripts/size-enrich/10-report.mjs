// Gera relatório CSV dos produtos que ficaram sem tamanho (para revisão manual).
import fs from 'node:fs'
import path from 'node:path'
import { readCache, ROOT } from './lib.mjs'

const REASON = {
  'kit-skip': 'Kit/combo/unidades: não há um único tamanho',
  'kit-multiple-sizes': 'Kit com vários tamanhos já descritos no nome',
  conflict: 'Fontes públicas divergem (ex.: 200 G vs 200 ML) — não foi arriscado',
  'ean-type-mismatch': 'EAN aponta para produto de outro tipo — não foi arriscado',
  unresolved: 'Sem correspondência exata em lojas públicas (ou sem tamanho aplicável, ex.: acessórios)',
  'dropped-sanity': 'Item sem tamanho aplicável (ferramenta/acessório)',
}
const res = readCache('resolved.json', []).filter((r) => !r.size)
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
const lines = ['nome,slug,motivo,detalhes']
for (const r of res) lines.push([q(r.name), q(r.slug), q(REASON[r.source] || r.source), q(r.notes.join(' ; '))].join(','))
const out = path.join(ROOT, 'produtos-sem-ml-revisar.csv')
fs.writeFileSync(out, '\uFEFF' + lines.join('\n'), 'utf8')
const by = {}
for (const r of res) by[r.source] = (by[r.source] || 0) + 1
console.log(out, res.length, by)
