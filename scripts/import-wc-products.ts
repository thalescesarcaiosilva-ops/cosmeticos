import fs from 'node:fs'
import path from 'node:path'
import { filterImportableImages } from '../src/lib/import/image-source-policy'
import { parseWooCommerceCsv, summarizeWooCommerceImport } from '../src/lib/import/woocommerce-csv'
import { importWooCommerceBatch } from '../src/lib/import/run-woocommerce-import'
import { createAdminClient } from '../src/lib/supabase/admin'

const CSV_PATH =
  process.argv.find((a) => !a.startsWith('-') && a.endsWith('.csv')) ??
  'd:/produtoscosmeticosvalormercado_1000.csv'
const REMAINING_ONLY = process.argv.includes('--remaining')
const REFRESH_EXISTING = process.argv.includes('--refresh-existing')
const BATCH_SIZE = 5
const ADMIN_USER_ID = process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'

function withEpocaImagesOnly<T extends { images: { url: string; alt: string }[] }>(row: T): T {
  return { ...row, images: filterImportableImages(row.images) }
}

async function main() {
  const resolved = path.resolve(CSV_PATH)
  if (!fs.existsSync(resolved)) {
    console.error(`Arquivo não encontrado: ${resolved}`)
    process.exit(1)
  }

  const text = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '')
  const allRows = parseWooCommerceCsv(text).map(withEpocaImagesOnly)
  const admin = createAdminClient()

  const { data: existing, error: existingError } = await admin
    .from('products')
    .select('woocommerce_id, slug')

  if (existingError) {
    console.error('Falha ao listar produtos existentes:', existingError.message)
    process.exit(1)
  }

  const wooSet = new Set(
    (existing ?? [])
      .map((p) => p.woocommerce_id)
      .filter((id): id is number => id != null)
  )
  const slugSet = new Set((existing ?? []).map((p) => p.slug))

  let rows = allRows
  if (REMAINING_ONLY) {
    const before = rows.length
    rows = rows.filter((r) => !wooSet.has(r.wooId) && !slugSet.has(r.slug))
    console.log(`Pendentes: ${rows.length} (${before - rows.length} já no banco)`)
  } else if (REFRESH_EXISTING) {
    rows = rows.filter((r) => wooSet.has(r.wooId) || slugSet.has(r.slug))
    rows = rows.filter((r) => r.images.length > 0)
    console.log(`Atualização de imagens Época em produtos existentes: ${rows.length}`)
  }

  if (rows.length === 0) {
    console.log('Nenhum produto para processar neste modo.')
  } else {
    console.log('Resumo:', summarizeWooCommerceImport(rows))

    const aggregate = {
      created: 0,
      updated: 0,
      skipped: 0,
      categoriesCreated: 0,
      brandsCreated: 0,
      imagesImported: 0,
      errors: [] as { slug: string; message: string }[],
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE)
      console.log(`\nLote ${batchNum}/${totalBatches} (${batch.length} produtos)...`)

      const result = await importWooCommerceBatch(batch, {
        updateImages: true,
        adminUserId: ADMIN_USER_ID,
        reuseExistingMedia: true,
      })

      aggregate.created += result.created
      aggregate.updated += result.updated
      aggregate.skipped += result.skipped
      aggregate.categoriesCreated += result.categoriesCreated
      aggregate.brandsCreated += result.brandsCreated
      aggregate.imagesImported += result.imagesImported
      aggregate.errors.push(...result.errors)

      console.log(
        `  criados=${result.created} atualizados=${result.updated} ignorados=${result.skipped} imagens=${result.imagesImported}`
      )
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(`  ERRO ${err.slug}: ${err.message}`)
        }
      }
    }

    console.log('\n=== Importação concluída ===')
    console.log(JSON.stringify(aggregate, null, 2))
    if (aggregate.errors.length > 0) process.exitCode = 1
  }

  const csvWooSet = new Set(allRows.map((r) => r.wooId))
  const csvSlugSet = new Set(allRows.map((r) => r.slug))

  const { data: activeProducts, error: listError } = await admin
    .from('products')
    .select('id, slug, woocommerce_id')
    .eq('active', true)

  if (listError) {
    console.error('Falha ao listar produtos ativos:', listError.message)
    process.exit(1)
  }

  const deactivateIds = (activeProducts ?? [])
    .filter((p) => {
      const inCsvByWoo = p.woocommerce_id != null && csvWooSet.has(p.woocommerce_id)
      const inCsvBySlug = csvSlugSet.has(p.slug)
      return !inCsvByWoo && !inCsvBySlug
    })
    .map((p) => p.id)

  let deactivated = 0
  if (deactivateIds.length > 0) {
    const { error } = await admin
      .from('products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .in('id', deactivateIds)
    if (error) {
      console.error('Falha ao desativar produtos extras:', error.message)
    } else {
      deactivated = deactivateIds.length
      console.log(`Desativados ${deactivated} produtos fora do CSV.`)
    }
  }

  const { count: totalActive } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  console.log(
    JSON.stringify(
      {
        csvTotal: allRows.length,
        activeProducts: totalActive ?? 0,
        deactivated,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
