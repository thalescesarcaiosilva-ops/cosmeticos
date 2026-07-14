import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'

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

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

async function cleanCatalog(admin: ReturnType<typeof createAdminClient>) {
  console.log('=== Limpando catálogo ===')

  const tables = [
    'product_bundles',
    'product_favorites',
    'product_reviews',
    'product_variations',
    'order_items',
    'product_images',
    'product_categories',
    'products',
    'categories',
    'brands',
    'media_assets',
    'menu_items',
  ]

  for (const table of tables) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      const msg = error.message.toLowerCase()
      if (
        error.code === '42P01' ||
        msg.includes('does not exist') ||
        msg.includes('schema cache')
      ) {
        console.log(`  ${table}: ignorado (tabela ausente)`)
        continue
      }
      throw new Error(`Falha ao limpar ${table}: ${error.message}`)
    }
    console.log(`  ${table}: ${count ?? 0} removidos`)
  }

  const paths: string[] = []
  async function collect(prefix: string) {
    const { data: items } = await admin.storage.from('product-images').list(prefix, { limit: 1000 })
    for (const item of items ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) paths.push(full)
      else await collect(full)
    }
  }
  await collect('')
  if (paths.length > 0) {
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from('product-images').remove(paths.slice(i, i + 100))
    }
    console.log(`  storage/product-images: ${paths.length} arquivos removidos`)
  } else {
    console.log('  storage/product-images: vazio')
  }
}

async function main() {
  const admin = createAdminClient()
  await cleanCatalog(admin)
  console.log('\nCatálogo limpo.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
