import { jsonSuccess } from '@/lib/api/response'

/**
 * Mantido por compatibilidade com o checkout que chama /api/checkout/warmup.
 * A Veno não precisa de warm-up (sem cold start Render).
 */
export async function POST() {
  return jsonSuccess({ ok: true })
}
