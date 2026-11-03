// Troca as imagens pelas da Drogaria Carvalho nos produtos com correspondência de confiança alta.
// Não altera título, descrição nem preço. Sem --apply roda em simulação.
import fs from 'node:fs'
import path from 'node:path'
import { CACHE_DIR, ROOT, sleep } from '../size-enrich/lib.mjs'
import { admin, replaceImages } from './media.mjs'

const MATCHES = path.join(CACHE_DIR, 'carvalho-matches.json')
const LOCAL = path.join(ROOT, 'scripts/dup-audit/all.json')
const APPLY = process.argv.includes('--apply')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 0)
const WORKERS = Number(process.argv.find((a) => a.startsWith('--workers='))?.split('=')[1] || 2)

const matches = JSON.parse(fs.readFileSync(MATCHES, 'utf8'))
const local = fs.existsSync(LOCAL) ? JSON.parse(fs.readFileSync(LOCAL, 'utf8')) : []
const byId = new Map(local.map((p) => [p.id, p]))

const plan = Object.entries(matches)
  .filter(([id, rec]) => {
    if (rec.status !== 'match' || rec.confidence !== 'alta' || !rec.images?.length || rec.imagesApplied) {
      return false
    }
    const product = byId.get(id)
    if (product && product.active === false) return false
    return true
  })
  .map(([id, rec]) => ({
    id,
    rec,
    product: byId.get(id) || { id, slug: rec.slug || id, name: rec.name || '' },
  }))

const todo = LIMIT > 0 ? plan.slice(0, LIMIT) : plan
console.log('imagens', todo.length, APPLY ? '(APLICANDO)' : '(simulação)')
if (!APPLY) process.exit(0)

function shortErr(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (/522|Connection timed out/i.test(message)) return 'HTTP 522 timeout'
  return message.replace(/\s+/g, ' ').slice(0, 160)
}

async function waitForSupabase(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await admin.from('products').select('id').limit(1)
      if (!error && data) {
        console.log('supabase ok')
        return
      }
      console.warn(`supabase aguardando (${i + 1}/${retries})`, shortErr(error?.message || 'sem dados'))
    } catch (error) {
      console.warn(`supabase aguardando (${i + 1}/${retries})`, shortErr(error))
    }
    await sleep(10000)
  }
  throw new Error('Supabase indisponível após várias tentativas')
}

await waitForSupabase()

const sampleIds = todo.slice(0, Math.min(todo.length, 50)).map((t) => t.id)
try {
  const { data, error } = await admin
    .from('product_images')
    .select('product_id,media_id,sort_order')
    .in('product_id', sampleIds)
  if (error) throw error
  const backupFile = path.join(
    CACHE_DIR,
    `backup-carvalho-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  )
  fs.writeFileSync(backupFile, JSON.stringify({ images: data || [], note: 'amostra inicial; apply marca imagesApplied no matches' }))
  console.log('backup amostra', backupFile, (data || []).length)
} catch (error) {
  console.warn('backup pulado:', error instanceof Error ? error.message : error)
}

let ok = 0
let failed = 0
const queue = [...todo]
let saving = Promise.resolve()
const save = () => {
  saving = saving.then(() => fs.writeFileSync(MATCHES, JSON.stringify(matches)))
  return saving
}

async function worker() {
  while (queue.length) {
    const item = queue.shift()
    if (!item) return
    const { id, rec, product } = item
    let attempt = 0
    while (attempt < 4) {
      attempt += 1
      try {
        rec.imageCount = await replaceImages(id, rec.images, rec.name || product.name)
        rec.imagesApplied = new Date().toISOString()
        delete rec.applyError
        ok += 1
        console.log('ok', ok, '/', todo.length, product.slug, `imgs ${rec.imageCount}`)
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        rec.applyError = message
        if (attempt < 4 && /timeout|522|aborted|fetch failed|ECONNRESET/i.test(message)) {
          console.warn('retry', attempt, product.slug, message)
          await sleep(3000 * attempt)
          continue
        }
        failed += 1
        console.error('falha', product.slug, message)
        break
      }
    }
    if ((ok + failed) % 3 === 0) await save()
    await sleep(80)
  }
}

await Promise.all(Array.from({ length: Math.max(1, WORKERS) }, () => worker()))
await save()
console.log(JSON.stringify({ ok, failed, remaining: todo.length - ok - failed }))
