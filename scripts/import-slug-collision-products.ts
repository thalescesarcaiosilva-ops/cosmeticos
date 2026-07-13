import fs from 'node:fs'
import { parseWooCommerceCsv } from '../src/lib/import/woocommerce-csv'
import { filterImportableImages } from '../src/lib/import/image-source-policy'
import { importWooCommerceBatch } from '../src/lib/import/run-woocommerce-import'
import { createAdminClient } from '../src/lib/supabase/admin'

const MISSING_WOO_IDS = [104221, 104449, 104477]
const ADMIN_USER_ID = process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'

async function main() {
  const text = fs.readFileSync('d:/produtoscosmeticosvalormercado_1000.csv', 'utf8').replace(/^\uFEFF/, '')
  const rows = parseWooCommerceCsv(text)
    .filter((r) => MISSING_WOO_IDS.includes(r.wooId))
    .map((r) => ({
      ...r,
      images: filterImportableImages(r.images),
    }))

  if (rows.length !== MISSING_WOO_IDS.length) {
    console.error('Nem todos os produtos com slug duplicado foram encontrados no CSV', rows.map((r) => r.wooId))
    process.exit(1)
  }

  console.log('Importando produtos com slug duplicado:', rows.map((r) => ({ wooId: r.wooId, slug: r.slug, name: r.name })))

  const result = await importWooCommerceBatch(rows, {
    updateImages: true,
    adminUserId: ADMIN_USER_ID,
    reuseExistingMedia: true,
  })

  console.log(JSON.stringify(result, null, 2))

  const admin = createAdminClient()
  const { count } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  console.log('Produtos ativos:', count)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
