import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../size-enrich/lib.mjs'

loadEnv()
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const select = `
  id, name, slug, price, original_price, stock,
  brand:brands(id, name, slug, active),
  product_categories(category_id, categories(id, name, slug, parent_id)),
  product_images(id, sort_order, media:media_assets(id, public_url, thumb_url, medium_url, alt_text, filename)),
  collection_link:product_categories!inner(category_id)
`

for (const slug of ['dermocosmeticos', 'cuidados-capilares', 'maquiagem']) {
  const { data: cat, error: catErr } = await db.from('categories').select('id').eq('slug', slug).single()
  if (catErr) {
    console.log(slug, 'cat', catErr.message)
    continue
  }
  const q = await db
    .from('products')
    .select(select, { count: 'exact' })
    .eq('collection_link.category_id', cat.id)
    .eq('active', true)
    .order('name')
    .range(0, 23)
  console.log(slug, {
    error: q.error?.message ?? null,
    rows: q.data?.length ?? 0,
    total: q.count,
    first: q.data?.[0]?.name ?? null,
    image: Boolean(q.data?.[0]?.product_images?.length),
  })
}
