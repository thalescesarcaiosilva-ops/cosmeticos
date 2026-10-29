// Aplica no Supabase: size_label (todos os produtos resolvidos) e descrições novas (somente as cruas).
// name e slug NUNCA são alterados. Uso: node scripts/size-enrich/09-apply.mjs [--apply]
import { supa, readCache, writeCache } from './lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = supa()
const resolved = readCache('resolved.json', [])
const descs = readCache('descriptions.json', {})

const current = Object.fromEntries(
  (await db.select('products?select=id,slug,name,description,size_label&active=eq.true')).map((r) => [r.id, r])
)
const plain = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const sizeUpdates = resolved.filter((r) => r.size && current[r.id] && current[r.id].size_label !== r.size)
const descUpdates = Object.values(descs).filter((d) => {
  const c = current[d.id]
  if (!c) return false
  // só sobrescreve se a descrição atual ainda é "crua" (nada foi editado desde a análise)
  return plain(c.description).length < 200
})

console.log({
  ativos: Object.keys(current).length,
  sizeUpdates: sizeUpdates.length,
  descUpdates: descUpdates.length,
  descIgnoradasPorJaTeremTexto: Object.keys(descs).length - descUpdates.length,
})

if (!APPLY) {
  console.log('dry-run (use --apply para gravar)')
  process.exit(0)
}

writeCache('backup-before-apply.json', {
  at: new Date().toISOString(),
  sizes: sizeUpdates.map((r) => ({ id: r.id, old: current[r.id].size_label })),
  descriptions: descUpdates.map((d) => ({ id: d.id, old: current[d.id].description })),
})

async function pool(items, n, fn) {
  const q = [...items]
  let done = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (q.length) {
        const it = q.shift()
        await fn(it)
        if (++done % 200 === 0) console.log('  ...', done, '/', items.length)
      }
    })
  )
}

console.log('gravando size_label...')
await pool(sizeUpdates, 6, (r) => db.patch('products', r.id, { size_label: r.size }))
console.log('gravando descrições...')
await pool(descUpdates, 6, (d) => db.patch('products', d.id, { description: d.html }))
console.log('ok')
