/**
 * Reenvia pedidos pagos (sem Track7) para a API Track7.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sync-paid-orders-track7.ts
 *   npx tsx --env-file=.env.local scripts/sync-paid-orders-track7.ts --limit=20
 *   npx tsx --env-file=.env.local scripts/sync-paid-orders-track7.ts --dry-run
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { isTrack7Configured } from '../src/lib/track7/client'
import { syncOrderToTrack7 } from '../src/lib/track7/sync-order'

function argValue(name: string): string | null {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const limit = Math.max(1, Number(argValue('limit') ?? '50') || 50)

  if (!isTrack7Configured()) {
    console.error(
      'TRACK7_API_KEY não configurada. Defina em .env.local (e na Vercel) e tente de novo.'
    )
    process.exit(1)
  }

  const admin = createAdminClient()
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, status, payment_status, tracking_code, track7_synced_at, created_at')
    .eq('payment_status', 'paid')
    .is('track7_synced_at', null)
    .is('tracking_code', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Falha ao listar pedidos:', error.message)
    process.exit(1)
  }

  const list = orders ?? []
  console.log(`Pedidos elegíveis: ${list.length}${dryRun ? ' (dry-run)' : ''}`)

  let ok = 0
  let fail = 0

  for (const order of list) {
    if (dryRun) {
      console.log('[dry-run]', order.id, order.status, order.created_at)
      continue
    }

    const result = await syncOrderToTrack7(order.id, { force: true })
    if (result.ok) {
      ok += 1
      console.log('OK', order.id, result.reason, result.trackingCode ?? '')
    } else {
      fail += 1
      console.warn('FAIL', order.id, result.reason)
    }
  }

  console.log(`Concluído. ok=${ok} fail=${fail}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
