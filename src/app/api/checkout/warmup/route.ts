import { jsonSuccess } from '@/lib/api/response'
import { warmUpAllowPay } from '@/lib/allowpay/client'

/**
 * Chamado quando o checkout abre, só para tirar o provedor de Pix do repouso.
 * Responde sempre 200: falhar aqui não pode atrapalhar o checkout.
 */
export async function POST() {
  await warmUpAllowPay()
  return jsonSuccess({ ok: true })
}
