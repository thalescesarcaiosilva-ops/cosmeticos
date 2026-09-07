import { jsonError } from '@/lib/api/response'

export const CARD_UNAVAILABLE_MESSAGE =
  'Pagamento com cartão indisponível no momento. Por favor, finalize a compra com Pix.'

/**
 * O provedor atual (AllowPay) processa apenas Pix.
 * A rota permanece para responder de forma explícita a qualquer chamada direta.
 */
export async function POST() {
  return jsonError(CARD_UNAVAILABLE_MESSAGE, 503, 'CARD_UNAVAILABLE')
}
