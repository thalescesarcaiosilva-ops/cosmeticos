import fs from 'node:fs'
import { norm, findSizes, sizeKey } from '../size-enrich/lib.mjs'
const all = JSON.parse(fs.readFileSync('scripts/dup-audit/all.json','utf8')).filter(r=>r.active)
const { out } = JSON.parse(fs.readFileSync('scripts/dup-audit/final.json','utf8'))
const known = new Set(out.map(o=>o.slug))
// GTIN checks
const chk = (g)=>{ if(!/^\d+$/.test(g)) return 'nao-numerico'; if(![8,12,13,14].includes(g.length)) return 'tamanho-'+g.length; const d=g.split('').map(Number); const c=d.pop(); let s=0; d.reverse().forEach((x,i)=>s+=x*(i%2===0?3:1)); return (10-s%10)%10===c?'ok':'checksum-invalido' }
const st={}; const bad=[]
for (const r of all) if (r.gtin){ const k=chk(r.gtin.trim()); st[k]=(st[k]||0)+1; if(k!=='ok') bad.push(r) }
console.log('GTIN status', st)
// GTIN quase iguais (um e o outro com 1 digito a mais / zeros)
const g = all.filter(r=>r.gtin).map(r=>({r,g:r.gtin.trim().replace(/^0+/,'')}))
const near=[]
for (let i=0;i<g.length;i++) for (let j=i+1;j<g.length;j++){ const a=g[i].g,b=g[j].g; if(a===b) continue; const [s,l]=a.length<=b.length?[a,b]:[b,a]; if(l.length-s.length>=1&&l.length-s.length<=2&&s.length>=8&&(l.startsWith(s)||l.endsWith(s))) near.push([g[i].r.name,g[i].r.gtin,g[j].r.name,g[j].r.gtin,g[i].r.id,g[j].r.id]) }
console.log('GTIN quase iguais', near.length); near.forEach(n=>console.log(' ',n.join(' | ')))
fs.writeFileSync('scripts/dup-audit/gtin-bad.json', JSON.stringify({st, near, bad: bad.map(r=>({name:r.name,gtin:r.gtin,slug:r.slug}))}))
// rede larga: contencao
const STOP=new Set('de da do das dos e com para em o a os as um uma the by of and ml g gr kg l un'.split(' '))
const tk=(r)=>[...new Set(norm(r.name).replace(/(?<![\w.])\d{1,4}(?:\.\d{1,2})?\s*(ml|g|kg|l|gr|mg)(?![a-z0-9])/g,' ').split(' ').filter(t=>t&&!STOP.has(t)))]
const sz=(r)=>{ if(r.size_label) return r.size_label.toUpperCase().replace(/\s+/g,''); const s=findSizes(r.name); return s.length===1?s[0].label.replace(/\s+/g,''):null }
const it=all.map(r=>({r,t:tk(r),s:sz(r)}))
const wide=[]
for(let i=0;i<it.length;i++)for(let j=i+1;j<it.length;j++){const a=it[i],b=it[j]; if(a.s&&b.s&&a.s!==b.s) continue; const [sm,bg]=a.t.length<=b.t.length?[a,b]:[b,a]; if(sm.t.length<4) continue; if(!sm.t.every(t=>bg.t.includes(t))) continue; const ex=bg.t.length-sm.t.length; if(ex<1||ex>6) continue; if(known.has(a.r.slug)&&known.has(b.r.slug)) continue; wide.push([ex,a.r.name,b.r.name,a.r.id,b.r.id,bg.t.filter(t=>!sm.t.includes(t))]) }
console.log('rede larga novos:', wide.length)
wide.sort((x,y)=>x[0]-y[0]).slice(0,80).forEach(w=>console.log(w[0],'|',w[1],'<=>',w[2]))

fs.writeFileSync('scripts/dup-audit/extra.json', JSON.stringify({near, wide}))

