/**
 * Otimiza assets da vitrine (logo, categorias, /loja.webp, banners).
 * NÃO altera media_assets.public_url — feed Merchant / JSON-LD de produto intactos.
 *
 * Uso: npx tsx --env-file=.env.local scripts/optimize-site-assets.ts
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { createAdminClient } from '../src/lib/supabase/admin'
import { toSiteMediaUrl } from '../src/lib/media/public-url'
import { SITE_SETTINGS_ID } from '../src/lib/layout/queries'

const WEBP_QUALITY = 80
const STORAGE_PREFIX = '/storage/v1/object/public/'

type StorageRef = { bucket: string; objectPath: string }

function parseStorageUrl(url: string | null | undefined): StorageRef | null {
  const normalized = toSiteMediaUrl(url ?? null)
  if (!normalized) return null

  const pathname = normalized.startsWith('http')
    ? new URL(normalized).pathname
    : normalized.split('?')[0]

  if (!pathname.startsWith(STORAGE_PREFIX)) return null
  const rest = pathname.slice(STORAGE_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  return { bucket: rest.slice(0, slash), objectPath: rest.slice(slash + 1) }
}

async function downloadStorage(admin: ReturnType<typeof createAdminClient>, ref: StorageRef) {
  const { data, error } = await admin.storage.from(ref.bucket).download(ref.objectPath)
  if (error || !data) throw new Error(error?.message ?? `Falha ao baixar ${ref.bucket}/${ref.objectPath}`)
  return Buffer.from(await data.arrayBuffer())
}

async function toWebp(buffer: Buffer, maxEdge: number) {
  const webp = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toBuffer()
  const meta = await sharp(webp).metadata()
  return { buffer: webp, width: meta.width ?? maxEdge, height: meta.height ?? maxEdge, size: webp.byteLength }
}

function siblingWebpPath(objectPath: string, suffix: string) {
  const withoutExt = objectPath.replace(/\.(webp|png|jpe?g|gif|avif)$/i, '')
  if (withoutExt.endsWith(`.${suffix}`)) return `${withoutExt}.webp`
  return `${withoutExt}.${suffix}.webp`
}

async function uploadWebp(
  admin: ReturnType<typeof createAdminClient>,
  ref: StorageRef,
  objectPath: string,
  buffer: Buffer
) {
  const { error } = await admin.storage.from(ref.bucket).upload(objectPath, buffer, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw new Error(error.message)
  const publicUrl = admin.storage.from(ref.bucket).getPublicUrl(objectPath).data.publicUrl
  return toSiteMediaUrl(publicUrl) ?? publicUrl
}

async function optimizeLojaWebp() {
  const filePath = path.join(process.cwd(), 'public', 'loja.webp')
  const tempPath = path.join(process.cwd(), 'public', 'loja.opt.webp')
  const before = await sharp(filePath, { failOn: 'none' }).metadata()
  const optimized = await sharp(filePath, { failOn: 'none' })
    .rotate()
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toBuffer()
  await writeFile(tempPath, optimized)
  try {
    await writeFile(filePath, optimized)
  } catch (err) {
    console.log(
      `loja.webp: não deu para substituir o arquivo original (${err instanceof Error ? err.message : err}). Gerado public/loja.opt.webp`
    )
    const after = await sharp(optimized).metadata()
    console.log(`  ${before.width}x${before.height} → ${after.width}x${after.height}, ${optimized.byteLength} bytes`)
    return
  }
  const after = await sharp(optimized).metadata()
  console.log(
    `loja.webp: ${before.width}x${before.height} → ${after.width}x${after.height}, ${optimized.byteLength} bytes`
  )
}

async function optimizeLogo(admin: ReturnType<typeof createAdminClient>) {
  const { data: settings, error } = await admin
    .from('site_settings')
    .select('logo_image_url')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const current = settings?.logo_image_url as string | null
  if (!current) {
    console.log('Logo: nenhuma URL cadastrada')
    return
  }
  if (/\.display\.webp(\?|$)/i.test(current)) {
    console.log('Logo: já em WebP de display, pulando')
    return
  }

  const ref = parseStorageUrl(current)
  if (!ref) {
    console.log(`Logo: URL fora do storage (${current}), pulando`)
    return
  }

  const original = await downloadStorage(admin, ref)
  const display = await toWebp(original, 480)
  const displayPath = siblingWebpPath(ref.objectPath, 'display')
  const displayUrl = await uploadWebp(admin, ref, displayPath, display.buffer)

  const { error: updateError } = await admin
    .from('site_settings')
    .update({ logo_image_url: displayUrl })
    .eq('id', SITE_SETTINGS_ID)
  if (updateError) throw new Error(updateError.message)

  console.log(
    `Logo: ${original.byteLength} bytes → ${display.size} bytes (${display.width}x${display.height})`
  )
  console.log(`  PNG original preservado: ${current}`)
  console.log(`  Vitrine agora usa: ${displayUrl}`)
}

async function optimizeCategories(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from('categories')
    .select('id, name, image_url')
    .not('image_url', 'is', null)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const current = row.image_url as string
    if (/\.display\.webp(\?|$)/i.test(current)) {
      console.log(`Categoria ${row.name}: já otimizada`)
      continue
    }
    const ref = parseStorageUrl(current)
    if (!ref) {
      console.log(`Categoria ${row.name}: URL fora do storage, pulando`)
      continue
    }
    try {
      const original = await downloadStorage(admin, ref)
      const display = await toWebp(original, 200)
      const displayPath = siblingWebpPath(ref.objectPath, 'display')
      const displayUrl = await uploadWebp(admin, ref, displayPath, display.buffer)
      const { error: updateError } = await admin
        .from('categories')
        .update({ image_url: displayUrl })
        .eq('id', row.id)
      if (updateError) throw updateError
      console.log(
        `Categoria ${row.name}: ${original.byteLength} → ${display.size} bytes (${display.width}x${display.height})`
      )
    } catch (err) {
      console.error(`Categoria ${row.name}: falhou —`, err instanceof Error ? err.message : err)
    }
  }
}

async function optimizeBanners(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from('home_banners')
    .select('id, title, image_url, storage_path, device_target, width, height')
    .eq('active', true)
  if (error) {
    console.log(`Banners: ${error.message}`)
    return
  }

  for (const row of data ?? []) {
    const current = row.image_url as string
    if (/\.display\.webp(\?|$)/i.test(current)) {
      console.log(`Banner ${row.title}: já otimizado`)
      continue
    }
    const ref = parseStorageUrl(current)
    if (!ref) continue
    const device = (row.device_target as string | null) ?? 'both'
    const maxEdge = device === 'mobile' ? 1080 : 1600
    try {
      const original = await downloadStorage(admin, ref)
      const display = await toWebp(original, maxEdge)
      const displayPath = siblingWebpPath(ref.objectPath, 'display')
      const displayUrl = await uploadWebp(admin, ref, displayPath, display.buffer)
      const payload = {
        image_url: displayUrl,
        width: display.width,
        height: display.height,
        file_size: display.size,
      }
      let { error: updateError } = await admin.from('home_banners').update(payload).eq('id', row.id)
      if (updateError?.message.includes('file_size')) {
        const retry = await admin
          .from('home_banners')
          .update({ image_url: displayUrl, width: display.width, height: display.height })
          .eq('id', row.id)
        updateError = retry.error
      }
      if (updateError) throw updateError
      console.log(
        `Banner ${row.title} (${device}): ${original.byteLength} → ${display.size} bytes (${display.width}x${display.height})`
      )
    } catch (err) {
      console.error(`Banner ${row.title}: falhou —`, err instanceof Error ? err.message : err)
    }
  }
}

async function main() {
  const admin = createAdminClient()
  console.log('Otimizando assets da vitrine (produtos/public_url NÃO são alterados)...')
  try {
    await optimizeLojaWebp()
  } catch (err) {
    console.error('loja.webp falhou:', err instanceof Error ? err.message : err)
  }
  await optimizeLogo(admin)
  await optimizeCategories(admin)
  await optimizeBanners(admin)
  console.log('Concluído.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
