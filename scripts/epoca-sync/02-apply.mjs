// Aplica preço cheio (33% abaixo da Época, sem preço riscado) e troca as imagens.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { CACHE_DIR, findSizes, loadEnv, sizeKey, sleep, tokens } from '../size-enrich/lib.mjs'

const MATCHES = path.join(CACHE_DIR, 'epoca-seller-matches.json')
const ADMIN_USER_ID = 'e7741a3f-18f1-4af7-9b0a-38546be678da'
const BUCKET = 'product-images'
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0)

loadEnv()
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  process.exit(1)
}
const admin = createClient(supabaseUrl, serviceKey)

function readMatches() {
  return JSON.parse(fs.readFileSync(MATCHES, 'utf8'))
}
function writeMatches(data) {
  fs.writeFileSync(MATCHES, JSON.stringify(data))
}

async function downloadImage(url) {
  const candidates = [url, url.replace(/\/ids\/(\d+)-\d+-\d+\//, '/ids/$1/')]
  let lastError = null
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: { 'User-Agent': 'LojaCosmeticos-ProductImport/1.0', Accept: 'image/*' },
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const type = response.headers.get('content-type') || ''
      if (!type.startsWith('image/')) throw new Error('não é imagem')
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength < 1000 || buffer.byteLength > 10 * 1024 * 1024) {
        throw new Error(`tamanho inválido ${buffer.byteLength}`)
      }
      return buffer
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function uploadImage(buffer, alt) {
  const baseId = `epoca/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const specs = [
    { name: 'large', edge: 1600, suffix: 'large' },
    { name: 'medium', edge: 800, suffix: 'medium' },
    { name: 'thumb', edge: 400, suffix: 'thumb' },
  ]
  const uploaded = []
  try {
    for (const spec of specs) {
      const webp = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: spec.edge, height: spec.edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer()
      const storagePath = `${baseId}.${spec.suffix}.webp`
      const { error } = await admin.storage.from(BUCKET).upload(storagePath, webp, {
        contentType: 'image/webp',
        upsert: false,
      })
      if (error) throw new Error(error.message)
      uploaded.push({ ...spec, storagePath, size: webp.byteLength })
    }
  } catch (error) {
    if (uploaded.length) {
      await admin.storage.from(BUCKET).remove(uploaded.map((file) => file.storagePath))
    }
    throw error
  }

  const large = uploaded.find((file) => file.name === 'large')
  const medium = uploaded.find((file) => file.name === 'medium')
  const thumb = uploaded.find((file) => file.name === 'thumb')
  const publicPath = (storagePath) => `/storage/v1/object/public/${BUCKET}/${storagePath}`
  const { data, error } = await admin
    .from('media_assets')
    .insert({
      filename: path.basename(large.storagePath),
      storage_path: large.storagePath,
      bucket: BUCKET,
      public_url: publicPath(large.storagePath),
      thumb_url: publicPath(thumb.storagePath),
      medium_url: publicPath(medium.storagePath),
      mime_type: 'image/webp',
      size_bytes: large.size,
      alt_text: alt.slice(0, 255) || null,
      uploaded_by: ADMIN_USER_ID,
    })
    .select('id')
    .single()

  if (error || !data) {
    await admin.storage.from(BUCKET).remove(uploaded.map((file) => file.storagePath))
    throw new Error(error?.message || 'falha ao registrar mídia')
  }
  return data.id
}

async function replaceImages(productId, urls, alt) {
  const mediaIds = []
  for (const url of urls) {
    try {
      const buffer = await downloadImage(url)
      mediaIds.push(await uploadImage(buffer, alt))
    } catch (error) {
      console.warn('imagem falhou', productId, error instanceof Error ? error.message : error)
    }
    await sleep(40)
  }
  if (mediaIds.length === 0) throw new Error('nenhuma imagem nova')

  const { error: deleteError } = await admin.from('product_images').delete().eq('product_id', productId)
  if (deleteError) throw new Error(`limpar imagens: ${deleteError.message}`)

  const { error: insertError } = await admin.from('product_images').insert(
    mediaIds.map((media_id, index) => ({ product_id: productId, media_id, sort_order: index }))
  )
  if (insertError) throw new Error(`ligar imagens: ${insertError.message}`)
  return mediaIds.length
}

async function applyPrice(productId, newPrice) {
  const { error } = await admin
    .from('products')
    .update({ price: newPrice, original_price: null })
    .eq('id', productId)
  if (error) throw new Error(`preço: ${error.message}`)
}

const VARIANT_WORDS = new Set(['lite', 'riche', 'original', 'travel', 'mini', 'refil', 'refill', 'capsule'])

function sizeKeys(text) {
  const keys = new Set()
  for (const size of findSizes(text || '')) {
    const key = sizeKey(size.label)
    if (key) keys.add(key)
  }
  return [...keys]
}

function rejectReason(rec) {
  const storeSizes = sizeKeys(rec.storeName)
  const epocaSizes = sizeKeys(rec.itemName)
  if (storeSizes.length && epocaSizes.length && !storeSizes.some((key) => epocaSizes.includes(key))) {
    return `tamanho ${storeSizes.join('/')} x ${epocaSizes.join('/')}`
  }
  const storeTokens = new Set(tokens(rec.storeName))
  const epocaTokens = new Set(tokens(rec.itemName))
  const onlyStore = [...storeTokens].filter((token) => VARIANT_WORDS.has(token) && !epocaTokens.has(token))
  const onlyEpoca = [...epocaTokens].filter((token) => VARIANT_WORDS.has(token) && !storeTokens.has(token))
  if (onlyStore.length || onlyEpoca.length) {
    return `variante ${[...onlyStore, ...onlyEpoca].join(', ')}`
  }
  return null
}

const matches = readMatches()
const skipped = []
const ids = []
for (const [id, rec] of Object.entries(matches)) {
  if (rec.status !== 'match' || rec.applied || !rec.images?.length || !(rec.newPrice > 0)) continue
  const reason = rejectReason(rec)
  if (reason) {
    rec.status = 'skipped_conflict'
    rec.skipReason = reason
    skipped.push(`${reason} | ${rec.storeName} => ${rec.itemName}`)
    continue
  }
  ids.push(id)
}
writeMatches(matches)
const todo = LIMIT > 0 ? ids.slice(0, LIMIT) : ids
console.log('pulados', skipped.length)
for (const line of skipped) console.log('pular', line)
console.log('para aplicar', todo.length)

let saveChain = Promise.resolve()
function saveMatches() {
  const snapshot = JSON.stringify(matches)
  saveChain = saveChain.then(() => fs.writeFileSync(MATCHES, snapshot))
  return saveChain
}

let ok = 0
let failed = 0
const queue = [...todo]

async function worker() {
  while (queue.length) {
    const id = queue.shift()
    const rec = matches[id]
    try {
      const imageCount = await replaceImages(id, rec.images, rec.itemName || rec.storeName)
      await applyPrice(id, rec.newPrice)
      rec.applied = true
      rec.imageCount = imageCount
      rec.appliedAt = new Date().toISOString()
      ok += 1
      console.log('ok', ok, rec.slug, rec.storePrice, '->', rec.newPrice, 'imgs', imageCount)
    } catch (error) {
      rec.applyError = error instanceof Error ? error.message : String(error)
      failed += 1
      console.error('falha', rec.slug, rec.applyError)
    }
    if ((ok + failed) % 3 === 0) await saveMatches()
    await sleep(60)
  }
}

await Promise.all(Array.from({ length: 3 }, () => worker()))
await saveMatches()
console.log(JSON.stringify({ ok, failed, skipped: skipped.length }))
