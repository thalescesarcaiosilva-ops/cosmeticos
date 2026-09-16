/**
 * Importa woocommerce-import.csv como produtos INATIVOS.
 *
 * Regras:
 * - exige GTIN
 * - aceita ≥2 imagens
 * - estoque 99
 * - cria categoria Vitaminas e Suplementos se necessário
 * - NÃO cria Ofertas / Mamãe e Bebê (remapeia)
 * - sanitiza menções a concorrentes
 * - createOnly (não atualiza catálogo ativo)
 * - active=false
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/import-flat-inactive.ts
 *   npx tsx --env-file=.env.local scripts/import-flat-inactive.ts --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'
import { parseFlatWooCommerceCsv } from '../src/lib/import/flat-woocommerce-csv'
import { importWooCommerceBatch } from '../src/lib/import/run-woocommerce-import'
import { DEFAULT_PRODUCT_STOCK } from '../src/lib/products/stock'

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

const CSV_PATH =
  process.argv.find((a) => !a.startsWith('-') && a.endsWith('.csv')) ??
  path.resolve('woocommerce-import.csv')
const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 5
const ADMIN_USER_ID = process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'

async function main() {
  const resolved = path.resolve(CSV_PATH)
  if (!fs.existsSync(resolved)) {
    console.error(`Arquivo não encontrado: ${resolved}`)
    process.exit(1)
  }

  const text = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '')
  const parsed = parseFlatWooCommerceCsv(text, {
    minImages: 2,
    stock: DEFAULT_PRODUCT_STOCK,
    active: false,
  })

  console.log('=== Pré-filtro CSV ===')
  console.log(`Elegíveis (GTIN + ≥2 imgs + preço): ${parsed.products.length}`)
  console.log(`Sem GTIN (excluídos): ${parsed.skippedNoGtin.length}`)
  console.log(`Poucas imagens: ${parsed.skippedFewImages.length}`)
  console.log(`Sem preço: ${parsed.skippedNoPrice.length}`)

  const catCounts = new Map<string, number>()
  for (const p of parsed.products) {
    const cat = p.categoryNames[0] ?? '(vazio)'
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
  }
  console.log('Categorias destino:', Object.fromEntries([...catCounts.entries()].sort((a, b) => b[1] - a[1])))

  if (DRY_RUN) {
    console.log('\n[dry-run] Nenhum produto foi importado.')
    console.log('Amostra:', parsed.products.slice(0, 5).map((p) => ({
      name: p.name,
      gtin: p.gtin,
      brand: p.brandName,
      category: p.categoryNames[0],
      images: p.images.length,
      stock: p.stock,
      active: p.active,
    })))
    return
  }

  const admin = createAdminClient()
  const { data: existingGtins } = await admin.from('products').select('gtin').not('gtin', 'is', null)
  const liveGtinSet = new Set(
    (existingGtins ?? []).map((p) => String(p.gtin)).filter(Boolean)
  )

  const toImport = parsed.products.filter((p) => p.gtin && !liveGtinSet.has(p.gtin))
  const alreadyLive = parsed.products.length - toImport.length
  console.log(`\nJá no catálogo (GTIN): ${alreadyLive}`)
  console.log(`A importar como inativos: ${toImport.length}`)

  const aggregate = {
    created: 0,
    updated: 0,
    skipped: 0,
    categoriesCreated: 0,
    brandsCreated: 0,
    imagesImported: 0,
    errors: [] as { slug: string; message: string }[],
  }

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toImport.length / BATCH_SIZE)
    console.log(`\nLote ${batchNum}/${totalBatches} (${batch.length})...`)

    const result = await importWooCommerceBatch(batch, {
      updateImages: true,
      adminUserId: ADMIN_USER_ID,
      reuseExistingMedia: true,
      createOnly: true,
      relaxImageHosts: true,
    })

    aggregate.created += result.created
    aggregate.updated += result.updated
    aggregate.skipped += result.skipped
    aggregate.categoriesCreated += result.categoriesCreated
    aggregate.brandsCreated += result.brandsCreated
    aggregate.imagesImported += result.imagesImported
    aggregate.errors.push(...result.errors)

    console.log(
      `  criados=${result.created} ignorados=${result.skipped} imagens=${result.imagesImported} erros=${result.errors.length}`
    )
    for (const err of result.errors) {
      console.error(`  ERRO ${err.slug}: ${err.message}`)
    }
  }

  const { count: inactiveCount } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('active', false)

  console.log('\n=== Importação concluída ===')
  console.log(JSON.stringify(aggregate, null, 2))
  console.log(`Produtos inativos no banco agora: ${inactiveCount ?? '?'}`)

  if (aggregate.errors.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
