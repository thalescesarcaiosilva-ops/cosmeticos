// Aplica o resultado do 03-search-v2: preço (base × 0,67) e riscado (base × 1,38);
// troca imagens só nos produtos recentes com correspondência de confiança alta.
// Sem --apply roda em simulação. Antes de aplicar grava backup de preços e imagens.
import fs from 'node:fs'
import path from 'node:path'
import { CACHE_DIR, sleep, supa } from '../size-enrich/lib.mjs'
import { admin, replaceImages } from './media.mjs'

const MATCHES = path.join(CACHE_DIR, 'epoca-market-v2.json')
const APPLY = process.argv.includes('--apply')
const OLD_IMAGES = process.argv.includes('--imagens-antigos')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 0)
const STRICT_FROM = '2026-10-14'

const matches = JSON.parse(fs.readFileSync(MATCHES, 'utf8'))
const OLD_FILE = path.join(CACHE_DIR, 'epoca-seller-matches.json')
const previous = fs.existsSync(OLD_FILE) ? JSON.parse(fs.readFileSync(OLD_FILE, 'utf8')) : {}
const CARVALHO_FILE = path.join(CACHE_DIR, 'carvalho-matches.json')
const carvalho = fs.existsSync(CARVALHO_FILE) ? JSON.parse(fs.readFileSync(CARVALHO_FILE, 'utf8')) : {}
const carvalhoImages = (id) => carvalho[id]?.status === 'match' && carvalho[id].confidence === 'alta'
const redo = (id, rec) => previous[id]?.applied && previous[id].itemName && previous[id].itemName !== rec.itemName
const db = supa()
const products = await db.select('products?select=id,slug,name,price,original_price,created_at')
const byId = new Map(products.map((p) => [p.id, p]))

const plan = []
for (const [id, rec] of Object.entries(matches)) {
  const product = byId.get(id)
  if (!product || rec.status !== 'match' || rec.confidence !== 'alta' || rec.applied2) continue
  if (!(rec.newPrice > 0)) continue
  const recent = (product.created_at || '') >= STRICT_FROM
  const images = !carvalhoImages(id) && (recent || OLD_IMAGES || redo(id, rec)) && rec.images?.length > 0
  plan.push({ id, product, rec, images })
}
const todo = LIMIT > 0 ? plan.slice(0, LIMIT) : plan
console.log('preço', todo.length, 'com imagens', todo.filter((t) => t.images).length, APPLY ? '(APLICANDO)' : '(simulação)')
if (!APPLY) process.exit(0)

const ids = todo.map((t) => t.id)
const backupImages = []
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await admin.from('product_images').select('product_id,media_id,sort_order').in('product_id', ids.slice(i, i + 200))
  if (error) throw new Error(`backup imagens: ${error.message}`)
  backupImages.push(...data)
}
const backupFile = path.join(CACHE_DIR, `backup-epoca-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
fs.writeFileSync(
  backupFile,
  JSON.stringify({
    prices: todo.map((t) => ({ id: t.id, price: t.product.price, original_price: t.product.original_price })),
    images: backupImages,
  })
)
console.log('backup', backupFile)

let ok = 0
let failed = 0
const queue = [...todo]
let saving = Promise.resolve()
const save = () => (saving = saving.then(() => fs.writeFileSync(MATCHES, JSON.stringify(matches))))

async function worker() {
  while (queue.length) {
    const { id, product, rec, images } = queue.shift()
    try {
      if (images) rec.imageCount2 = await replaceImages(id, rec.images, rec.itemName || product.name)
      const { error } = await admin.from('products').update({ price: rec.newPrice, original_price: rec.listPrice }).eq('id', id)
      if (error) throw new Error(`preço: ${error.message}`)
      rec.applied2 = new Date().toISOString()
      ok += 1
      console.log('ok', ok, product.slug, product.price, '->', rec.newPrice, images ? `imgs ${rec.imageCount2}` : '')
    } catch (error) {
      rec.applyError2 = error instanceof Error ? error.message : String(error)
      failed += 1
      console.error('falha', product.slug, rec.applyError2)
    }
    if ((ok + failed) % 5 === 0) await save()
    await sleep(40)
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()))
await save()
console.log(JSON.stringify({ ok, failed }))
