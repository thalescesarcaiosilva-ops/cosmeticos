import { createAdminClient } from '@/lib/supabase/admin'

export async function incrementProductView(productId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('increment_product_view', {
    p_product_id: productId,
  })
  if (error) {
    // Fallback se RPC ainda não existir: upsert manual
    const day = new Date().toISOString().slice(0, 10)
    const { data: existing } = await admin
      .from('product_views_daily')
      .select('views')
      .eq('product_id', productId)
      .eq('day', day)
      .maybeSingle()

    if (existing) {
      await admin
        .from('product_views_daily')
        .update({ views: Number(existing.views) + 1 })
        .eq('product_id', productId)
        .eq('day', day)
    } else {
      await admin.from('product_views_daily').insert({
        product_id: productId,
        day,
        views: 1,
      })
    }
  }
}

export async function incrementNotFoundPath(
  path: string,
  referrer: string | null
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('increment_not_found', {
    p_path: path,
    p_referrer: referrer,
  })
  if (error) {
    const { data: existing } = await admin
      .from('not_found_paths')
      .select('hits, sample_referrer')
      .eq('path', path)
      .maybeSingle()

    if (existing) {
      await admin
        .from('not_found_paths')
        .update({
          hits: Number(existing.hits) + 1,
          last_seen_at: new Date().toISOString(),
          sample_referrer: referrer || existing.sample_referrer,
        })
        .eq('path', path)
    } else {
      await admin.from('not_found_paths').insert({
        path,
        hits: 1,
        last_seen_at: new Date().toISOString(),
        sample_referrer: referrer,
      })
    }
  }
}
