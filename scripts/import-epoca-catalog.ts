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
import {
  assignProductCategory,
  countPrimaryCategories,
  getHomeCarouselSlugs,
  STORE_CATEGORIES,
  type CategoryAssignment,
} from '../src/lib/import/category-consolidation'
import { parseEpocaWooCommerceCsv } from '../src/lib/import/epoca-csv'
import { importWooCommerceBatch } from '../src/lib/import/run-woocommerce-import'
import { filterImportableImages } from '../src/lib/import/image-source-policy'

const CSV_PATH =
  process.argv.find((a) => !a.startsWith('-') && a.endsWith('.csv')) ??
  'c:/importarprodutos/exportados/epoca_cosmeticos_1000_20260713_080620_woocommerce.csv'

const MIN_PRICE = 50
const BATCH_SIZE = 5
const ADMIN_USER_ID = process.env.IMPORT_ADMIN_USER_ID ?? 'e7741a3f-18f1-4af7-9b0a-38546be678da'

type PreparedProduct = ReturnType<typeof parseEpocaWooCommerceCsv>[number] & {
  storeCategorySlug: string
  storeCategoryName: string
  consolidationNote?: string
}

async function cleanCatalog(admin: ReturnType<typeof createAdminClient>) {
  console.log('\n=== Limpando catálogo existente ===')

  const steps: { table: string; filter?: string }[] = [
    { table: 'product_bundles' },
    { table: 'product_favorites' },
    { table: 'product_reviews' },
    { table: 'product_variations' },
    { table: 'order_items' },
    { table: 'product_images' },
    { table: 'product_categories' },
    { table: 'products' },
    { table: 'categories' },
    { table: 'brands' },
    { table: 'media_assets' },
    { table: 'menu_items' },
  ]

  for (const step of steps) {
    const { error, count } = await admin.from(step.table).delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      const msg = error.message.toLowerCase()
      if (
        error.code === '42P01' ||
        msg.includes('does not exist') ||
        msg.includes('schema cache')
      ) {
        console.log(`  ${step.table}: tabela não existe, ignorando`)
        continue
      }
      throw new Error(`Falha ao limpar ${step.table}: ${error.message}`)
    }
    console.log(`  ${step.table}: ${count ?? 0} registros removidos`)
  }

  const { data: files } = await admin.storage.from('product-images').list('', { limit: 1000 })
  if (files && files.length > 0) {
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
    }
  }
}

function prepareProducts(csvPath: string): {
  products: PreparedProduct[]
  finalCounts: Map<string, number>
  consolidationNotes: string[]
} {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
  const parsed = parseEpocaWooCommerceCsv(text, { minPrice: MIN_PRICE })

  const primaryCounts = countPrimaryCategories(
    parsed.map((p) => ({ rawCategoryPaths: p.categoryNames }))
  )

  const consolidationNotes: string[] = []
  const products: PreparedProduct[] = parsed.map((row) => {
    const assignment: CategoryAssignment = assignProductCategory(row.categoryNames, primaryCounts)
    if (assignment.reason) consolidationNotes.push(`${row.name.slice(0, 50)}: ${assignment.reason}`)
    return {
      ...row,
      storeCategorySlug: assignment.slug,
      storeCategoryName: assignment.name,
      consolidationNote: assignment.reason,
      categoryNames: [assignment.name],
    }
  })

  const finalCounts = new Map<string, number>()
  for (const p of products) {
    finalCounts.set(p.storeCategorySlug, (finalCounts.get(p.storeCategorySlug) ?? 0) + 1)
  }

  return { products, finalCounts, consolidationNotes }
}

async function ensureStoreCategories(admin: ReturnType<typeof createAdminClient>) {
  console.log('\n=== Criando categorias da loja ===')
  for (const cat of STORE_CATEGORIES) {
    const { error } = await admin.from('categories').upsert(
      {
        name: cat.name,
        slug: cat.slug,
        active: true,
        sort_order: cat.sortOrder,
      },
      { onConflict: 'slug' }
    )
    if (error) throw new Error(`Categoria ${cat.slug}: ${error.message}`)
    console.log(`  ${cat.name} (${cat.slug})`)
  }
}

async function syncMenu(admin: ReturnType<typeof createAdminClient>, activeSlugs: string[]) {
  console.log('\n=== Atualizando menu principal ===')
  const { data: categories } = await admin
    .from('categories')
    .select('id, name, slug, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const active = (categories ?? []).filter((c) => activeSlugs.includes(c.slug))
  let sortOrder = 1
  for (const cat of active) {
    const { error } = await admin.from('menu_items').insert({
      label: cat.name,
      slug: cat.slug,
      href: `/colecoes/${cat.slug}`,
      parent_id: null,
      has_dropdown: false,
      sort_order: sortOrder++,
      visible: true,
    })
    if (error) throw new Error(`Menu ${cat.slug}: ${error.message}`)
    console.log(`  ${cat.name} -> /colecoes/${cat.slug}`)
  }
}

function updateHomeConfig(homeSlugs: string[]) {
  const configPath = path.resolve('src/lib/home/config.ts')
  const content = `/**
 * Slugs das categorias exibidas na home (grid + carrosséis de produtos).
 * Ordem do array = ordem de exibição.
 * Máximo 5 carrosséis de produtos por categoria.
 * O grid "Compre por categoria" usa as mesmas categorias ativas.
 */
export const HOME_CATEGORY_SLUGS: string[] = [
${homeSlugs.map((s) => `  '${s}',`).join('\n')}
]
`
  fs.writeFileSync(configPath, content, 'utf8')
  console.log(`\n=== Home config atualizado ===`)
  console.log(`  Carrosséis: ${homeSlugs.join(', ')}`)
}

async function main() {
  const resolved = path.resolve(CSV_PATH)
  if (!fs.existsSync(resolved)) {
    console.error(`Arquivo não encontrado: ${resolved}`)
    process.exit(1)
  }

  console.log('CSV:', resolved)
  const { products, finalCounts, consolidationNotes } = prepareProducts(resolved)
  console.log(`\nProdutos elegíveis (preço > R$${MIN_PRICE}): ${products.length}`)
  console.log('\nDistribuição final por categoria:')
  for (const cat of STORE_CATEGORIES) {
    const count = finalCounts.get(cat.slug) ?? 0
    if (count > 0) console.log(`  ${cat.name}: ${count}`)
  }

  const activeSlugs = STORE_CATEGORIES.filter((c) => (finalCounts.get(c.slug) ?? 0) > 0).map(
    (c) => c.slug
  )
  const homeSlugs = getHomeCarouselSlugs(finalCounts)

  const admin = createAdminClient()
  await cleanCatalog(admin)
  await ensureStoreCategories(admin)

  console.log('\n=== Importando produtos ===')
  const aggregate = {
    created: 0,
    updated: 0,
    skipped: 0,
    categoriesCreated: 0,
    brandsCreated: 0,
    imagesImported: 0,
    errors: [] as { slug: string; message: string }[],
  }

  const rows = products.map((p) => ({
    ...p,
    images: filterImportableImages(p.images),
  }))

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE)
    console.log(`Lote ${batchNum}/${totalBatches} (${batch.length} produtos)...`)

    const result = await importWooCommerceBatch(batch, {
      updateImages: true,
      adminUserId: ADMIN_USER_ID,
      reuseExistingMedia: false,
    })

    aggregate.created += result.created
    aggregate.updated += result.updated
    aggregate.skipped += result.skipped
    aggregate.categoriesCreated += result.categoriesCreated
    aggregate.brandsCreated += result.brandsCreated
    aggregate.imagesImported += result.imagesImported
    aggregate.errors.push(...result.errors)

    console.log(
      `  criados=${result.created} imagens=${result.imagesImported} erros=${result.errors.length}`
    )
  }

  await syncMenu(admin, activeSlugs)
  updateHomeConfig(homeSlugs)

  const smallCats = STORE_CATEGORIES.filter(
    (c) => {
      const n = finalCounts.get(c.slug) ?? 0
      return n > 0 && n < 10
    }
  )

  console.log('\n=== Importação concluída ===')
  console.log(JSON.stringify(aggregate, null, 2))

  if (smallCats.length > 0) {
    console.log('\n⚠ Categorias com menos de 10 produtos (exceções):')
    for (const c of smallCats) {
      console.log(`  ${c.name}: ${finalCounts.get(c.slug)} produtos`)
      console.log(`    Motivo: não havia categoria pai adequada sem perder a semântica do produto.`)
    }
  }

  if (consolidationNotes.length > 0) {
    console.log(`\n📝 ${consolidationNotes.length} produtos tiveram categoria consolidada:`)
    const unique = [...new Set(consolidationNotes.map((n) => n.split(': ').slice(1).join(': ')))]
    unique.slice(0, 10).forEach((n) => console.log(`  - ${n}`))
    if (unique.length > 10) console.log(`  ... e mais ${unique.length - 10}`)
  }

  if (aggregate.errors.length > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
