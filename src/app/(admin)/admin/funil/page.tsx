import { createAdminClient } from '@/lib/supabase/admin'
import { FunnelReport } from '@/components/admin/FunnelReport'
import type { FunnelCountRow } from '@/components/admin/FunnelReport'

function asRows(data: unknown): FunnelCountRow[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const record = row as { step?: unknown; sessions?: unknown }
    if (typeof record.step !== 'string') return []
    const sessions = Number(record.sessions)
    if (!Number.isFinite(sessions)) return []
    return [{ step: record.step, sessions }]
  })
}

export default async function AdminFunnelPage() {
  const admin = createAdminClient()
  const [week, month] = await Promise.all([
    admin.rpc('store_funnel_counts', { day_count: 7 }),
    admin.rpc('store_funnel_counts', { day_count: 30 }),
  ])

  const error = week.error?.message || month.error?.message || null

  return <FunnelReport week={asRows(week.data)} month={asRows(month.data)} error={error} />
}
