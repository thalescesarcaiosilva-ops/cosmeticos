import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  const text = fs.readFileSync(path.resolve('.env.local'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#') || !l.includes('=')) continue
    const i = l.indexOf('=')
    const k = l.slice(0, i).trim()
    const v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnv()

const png = await sharp({
  create: { width: 800, height: 800, channels: 3, background: { r: 200, g: 40, b: 80 } },
}).png().toBuffer()

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const webp = await sharp(png).webp({ quality: 82 }).toBuffer()
const storagePath = `probe-${Date.now()}.large.webp`

const base = `probe-par-${Date.now()}`
const results = await Promise.all(
  ['large', 'medium', 'thumb'].map((suffix) =>
    admin.storage.from('product-images').upload(`${base}.${suffix}.webp`, webp, {
      contentType: 'image/webp',
      upsert: false,
    })
  )
)
for (const r of results) console.log(r.error?.message ?? 'ok', r.data?.path ?? null)
const paths = results.map((r) => r.data?.path).filter(Boolean)
if (paths.length) await admin.storage.from('product-images').remove(paths)
