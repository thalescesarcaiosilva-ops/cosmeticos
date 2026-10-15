import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'
import { downloadRemoteImage } from '../src/lib/import/product-image-import'
import { sourceFilenameFromUrl } from '../src/lib/import/image-source-policy'
import { syncProductRelations } from '../src/lib/products/queries'
import { slugify } from '../src/lib/products/format'

function loadEnvLocal() {
  const envPath = path.resolve('.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
}

const ADMIN =
  process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'

async function epocaFt(q: string) {
  const url =
    'https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search?ft=' +
    encodeURIComponent(q) +
    '&_from=0&_to=5'
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  })
  const j = (await r.json()) as Array<{
    productName?: string
    items?: Array<{ images?: Array<{ imageUrl?: string }> }>
  }>
  if (!Array.isArray(j) || !j[0]) return { name: '', imgs: [] as string[] }
  return {
    name: j[0].productName || '',
    imgs: (j[0].items?.[0]?.images || [])
      .map((i) => i.imageUrl)
      .filter(Boolean) as string[],
  }
}

async function main() {
  const admin = createAdminClient()
  const jobs = [
    { slug: 'liftactiv-serum-vitamina-c-20ml', query: 'Liftactiv Supreme Vitamina C' },
    { slug: 'liftactiv-colageno-specialist', query: 'Liftactiv Collagen Specialist' },
    {
      slug: 'hidratantante-original-alien-mugler-200ml',
      query: 'Alien body lotion Mugler',
    },
  ]

  for (const job of jobs) {
    const { data: p } = await admin
      .from('products')
      .select('id, name')
      .eq('slug', job.slug)
      .maybeSingle()
    if (!p) {
      console.log('missing', job.slug)
      continue
    }
    const { count } = await admin
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', p.id)
    if ((count ?? 0) > 0) {
      console.log('already has imgs', job.slug, count)
      continue
    }

    const found = await epocaFt(job.query)
    console.log(job.slug, '=>', found.name, 'imgs', found.imgs.length)

    const mediaIds: string[] = []
    for (const url of found.imgs.slice(0, 6)) {
      try {
        const filename = (
          slugify(job.slug).slice(0, 40) +
          '-' +
          sourceFilenameFromUrl(url)
        ).slice(0, 255)
        const { data: existing } = await admin
          .from('media_assets')
          .select('id')
          .eq('filename', filename)
          .maybeSingle()
        if (existing) {
          if (!mediaIds.includes(existing.id)) mediaIds.push(existing.id)
          continue
        }
        const raw = await downloadRemoteImage(url)
        const { uploadOptimizedMediaVariants } = await import(
          '@/lib/media/upload-optimized'
        )
        const uploaded = await uploadOptimizedMediaVariants({
          bucket: 'product-images',
          fileBuffer: raw,
          folder: 'import',
        })
        const { data, error } = await admin
          .from('media_assets')
          .insert({
            filename,
            storage_path: uploaded.storagePath,
            bucket: 'product-images',
            public_url: uploaded.publicUrl,
            thumb_url: uploaded.thumbUrl,
            medium_url: uploaded.mediumUrl,
            mime_type: uploaded.mimeType,
            size_bytes: uploaded.sizeBytes,
            alt_text: p.name.slice(0, 255),
            uploaded_by: ADMIN,
          })
          .select('id')
          .single()
        if (error || !data) {
          await admin.storage.from('product-images').remove(uploaded.pathsToCleanup)
          throw new Error(error?.message ?? 'fail')
        }
        mediaIds.push(data.id)
      } catch (e) {
        console.error('fail', e instanceof Error ? e.message : e)
      }
    }

    if (mediaIds.length) {
      await syncProductRelations(p.id, undefined, mediaIds)
      console.log('OK', job.slug, mediaIds.length)
    } else {
      console.log('FAIL', job.slug)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
