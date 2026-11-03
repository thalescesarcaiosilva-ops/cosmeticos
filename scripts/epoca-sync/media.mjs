// Baixa imagens externas, gera WebP (large/medium/thumb) no Storage e religa ao produto.
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { loadEnv, sleep } from '../size-enrich/lib.mjs'

const ADMIN_USER_ID = 'e7741a3f-18f1-4af7-9b0a-38546be678da'
const BUCKET = 'product-images'

loadEnv()
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, '')
export const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(120000) }),
  },
})

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
      if (!(response.headers.get('content-type') || '').startsWith('image/')) throw new Error('não é imagem')
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
    { name: 'large', edge: 1600 },
    { name: 'medium', edge: 800 },
    { name: 'thumb', edge: 400 },
  ]
  const uploaded = []
  try {
    for (const spec of specs) {
      const webp = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: spec.edge, height: spec.edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer()
      const storagePath = `${baseId}.${spec.name}.webp`
      const { error } = await admin.storage.from(BUCKET).upload(storagePath, webp, { contentType: 'image/webp', upsert: false })
      if (error) throw new Error(error.message)
      uploaded.push({ ...spec, storagePath, size: webp.byteLength })
    }
  } catch (error) {
    if (uploaded.length) await admin.storage.from(BUCKET).remove(uploaded.map((f) => f.storagePath))
    throw error
  }
  const file = (name) => uploaded.find((f) => f.name === name)
  const publicPath = (p) => `/storage/v1/object/public/${BUCKET}/${p}`
  const { data, error } = await admin
    .from('media_assets')
    .insert({
      filename: path.basename(file('large').storagePath),
      storage_path: file('large').storagePath,
      bucket: BUCKET,
      public_url: publicPath(file('large').storagePath),
      thumb_url: publicPath(file('thumb').storagePath),
      medium_url: publicPath(file('medium').storagePath),
      mime_type: 'image/webp',
      size_bytes: file('large').size,
      alt_text: alt.slice(0, 255) || null,
      uploaded_by: ADMIN_USER_ID,
    })
    .select('id')
    .single()
  if (error || !data) {
    await admin.storage.from(BUCKET).remove(uploaded.map((f) => f.storagePath))
    throw new Error(error?.message || 'falha ao registrar mídia')
  }
  return data.id
}

export async function replaceImages(productId, urls, alt) {
  const mediaIds = []
  for (const url of urls) {
    try {
      mediaIds.push(await uploadImage(await downloadImage(url), alt))
    } catch (error) {
      console.warn('imagem falhou', productId, error instanceof Error ? error.message : error)
    }
    await sleep(40)
  }
  if (!mediaIds.length) throw new Error('nenhuma imagem nova')
  // As novas são ligadas antes de remover as antigas: se o banco falhar no meio, o produto não fica sem imagem.
  const { error: insertError } = await admin
    .from('product_images')
    .insert(mediaIds.map((media_id, index) => ({ product_id: productId, media_id, sort_order: index })))
  if (insertError) throw new Error(`ligar imagens: ${insertError.message}`)
  const { error: deleteError } = await admin
    .from('product_images')
    .delete()
    .eq('product_id', productId)
    .not('media_id', 'in', `(${mediaIds.join(',')})`)
  if (deleteError) throw new Error(`limpar imagens antigas: ${deleteError.message}`)
  return mediaIds.length
}
