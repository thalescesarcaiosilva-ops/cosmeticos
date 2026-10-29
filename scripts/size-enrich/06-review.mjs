import { readCache } from './lib.mjs'
const res = readCache('resolved.json', [])
const which = process.argv[2]
const show = (r) => console.log(`${r.size || '-'} | ${r.name} | ${r.source} | ${r.notes.join(' ; ')}`)
if (which === 'conflicts') res.filter((x) => x.source === 'conflict' || x.source === 'ean-type-mismatch').forEach(show)
if (which === 'source') res.filter((x) => x.source === process.argv[3]).forEach(show)
if (which === 'unresolved') res.filter((x) => x.source === 'unresolved').slice(Number(process.argv[3] || 0)).forEach(show)
