import { supa } from '../size-enrich/lib.mjs'
import fs from 'node:fs'
const db = supa()
const ma = await db.select('media_assets?select=id,filename,size_bytes,public_url')
const pi = JSON.parse(fs.readFileSync('scripts/dup-audit/pi.json','utf8'))
const all = JSON.parse(fs.readFileSync('scripts/dup-audit/all.json','utf8'))
const nameOf = Object.fromEntries(all.map(r=>[r.id,r]))
const mm = Object.fromEntries(ma.map(m=>[m.id,m]))
// produto -> chaves de imagem (media id e tamanho em bytes)
const byProdBytes = {}
for (const r of pi) { const m = mm[r.media_id]; if (!m) continue; (byProdBytes[r.product_id] ||= []).push({ media: r.media_id, bytes: m.size_bytes, order: r.sort_order }) }
const first = {}
for (const [p, l] of Object.entries(byProdBytes)) { l.sort((a,b)=>a.order-b.order); first[p] = l[0] }
fs.writeFileSync('scripts/dup-audit/firstimg.json', JSON.stringify(first))
// grupos de primeira imagem por media id compartilhada
const g = {}
for (const [p, f] of Object.entries(first)) (g[f.media] ||= []).push(p)
const sh = Object.values(g).filter(a=>a.length>1)
console.log('grupos 1a imagem mesma media:', sh.length)
for (const a of sh.slice(0,40)) console.log(a.map(id=>nameOf[id]?.name+(nameOf[id]?.active?'':' (INATIVO)')).join('  ||  '))
// mesmo tamanho exato em bytes (>20kb) em produtos diferentes
const gb = {}
for (const [p, f] of Object.entries(first)) if (f.bytes>20000) (gb[f.bytes] ||= []).push(p)
const sb = Object.values(gb).filter(a=>a.length>1)
console.log('grupos 1a imagem mesmos bytes:', sb.length)
fs.writeFileSync('scripts/dup-audit/imggroups.json', JSON.stringify({ sameMedia: sh, sameBytes: sb }))
