/**
 * Reimporta do CSV apenas produtos com "cápsulas/capsulas" no nome, como inativos.
 * Uso: npx tsx --env-file=.env.local scripts/restore-capsulas-inactive.ts
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

const CSV_PATH = path.resolve('woocommerce-import.csv')
const ADMIN_USER_ID = process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'
const CAPSULA_RE = /c[aá]psulas?/i

async function main() {
  const text = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const parsed = parseFlatWooCommerceCsv(text, {
    minImages: 2,
    stock: DEFAULT_PRODUCT_STOCK,
    active: false,
  })

  const capsulas = parsed.products.filter((p) => CAPSULA_RE.test(p.name))
  console.log(`Cápsulas elegíveis no CSV (com GTIN): ${capsulas.length}`)

  const admin = createAdminClient()
  const { data: existing } = await admin.from('products').select('gtin').not('gtin', 'is', null)
  const live = new Set((existing ?? []).map((p) => String(p.gtin)))
  const toImport = capsulas.filter((p) => p.gtin && !live.has(p.gtin))
  console.log(`Já no banco: ${capsulas.length - toImport.length}`)
  console.log(`A restaurar: ${toImport.length}`)

  if (toImport.length === 0) return

  const result = await importWooCommerceBatch(toImport, {
    updateImages: true,
    adminUserId: ADMIN_USER_ID,
    reuseExistingMedia: true,
    createOnly: true,
    relaxImageHosts: true,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
