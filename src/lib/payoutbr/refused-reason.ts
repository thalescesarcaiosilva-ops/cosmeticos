export type PayoutBrRefusedReason = {
  category?: string | null
  acquirerCode?: string | null
  description?: string | null
  createdAt?: string | null
}

export const DEFAULT_CARD_REFUSED_MESSAGE =
  'Pagamento recusado pela operadora. Tente outro cartão ou finalize com Pix para não perder a compra.'

const CTA = 'Tente outro cartão ou finalize com Pix para não perder a compra.'

/** Mensagens por categoria (APIs no padrão category + description). */
const CATEGORY_MESSAGES: Record<string, string> = {
  issuer_declined: `Seu banco não autorizou esta compra. Peça a liberação na central do cartão e tente de novo, ou use outro cartão/Pix.`,
  insufficient_funds: `Saldo ou limite insuficiente neste cartão. Libere limite, use outro cartão ou finalize com Pix.`,
  transaction_not_allowed: `Este cartão não permite esta compra (bloqueio do banco ou compras online). Use outro cartão ou Pix.`,
  invalid_card_data: `Dados do cartão inválidos. Confira número, validade e CVV, ou use outro cartão.`,
  temporary_unavailable: `Instabilidade temporária na rede do cartão. Aguarde alguns minutos e tente de novo, ou use Pix.`,
  suspected_fraud: `Pagamento não autorizado por segurança. Use outro cartão ou finalize com Pix.`,
  installments_exceeded: `O número de parcelas não é permitido para este cartão. Escolha menos parcelas, outro cartão ou Pix.`,
  expired_card: `Cartão vencido. Use outro cartão ou finalize com Pix.`,
  blocked_card: `Cartão bloqueado pelo banco. Use outro cartão ou finalize com Pix.`,
  invalid_cvv: `Código de segurança (CVV) inválido. Confira e tente de novo, ou use outro cartão.`,
}

/** Códigos comuns de adquirente (acquirerCode) → orientação ao cliente. */
const ACQUIRER_CODE_MESSAGES: Record<string, string> = {
  '05': `Seu banco não autorizou esta compra. Peça a liberação na central do cartão e tente de novo, ou use outro cartão/Pix.`,
  '51': `Saldo ou limite insuficiente neste cartão. Libere limite, use outro cartão ou finalize com Pix.`,
  '54': `Cartão vencido. Use outro cartão ou finalize com Pix.`,
  '57': `Este cartão não permite esta compra. Use outro cartão ou finalize com Pix.`,
  '58': `Este cartão não permite esta compra. Use outro cartão ou finalize com Pix.`,
  '61': `Limite do cartão excedido. Libere limite, use outro cartão ou finalize com Pix.`,
  '62': `Cartão com restrição. Use outro cartão ou finalize com Pix.`,
  '63': `Pagamento não autorizado por segurança. Use outro cartão ou finalize com Pix.`,
  '78': `Cartão ainda não desbloqueado para compras. Libere no app/central do banco, ou use outro cartão/Pix.`,
  '82': `Código de segurança (CVV) inválido. Confira e tente de novo, ou use outro cartão.`,
  '91': `Banco temporariamente indisponível. Aguarde alguns minutos e tente de novo, ou use Pix.`,
  '96': `Falha temporária no processamento. Tente de novo em instantes, ou use Pix.`,
  n7: `Código de segurança (CVV) inválido. Confira e tente de novo, ou use outro cartão.`,
}

type DescriptionRule = { test: RegExp; message: string }

const DESCRIPTION_RULES: DescriptionRule[] = [
  {
    test: /insufficient|saldo|limite|fund|nsufficient/i,
    message: `Saldo ou limite insuficiente neste cartão. Libere limite, use outro cartão ou finalize com Pix.`,
  },
  {
    test: /expired|vencid|expirad/i,
    message: `Cartão vencido. Use outro cartão ou finalize com Pix.`,
  },
  {
    test: /cvv|security.?code|c[oó]digo.?de.?seguran/i,
    message: `Código de segurança (CVV) inválido. Confira e tente de novo, ou use outro cartão.`,
  },
  {
    test: /invalid.?card|cart[aã]o.?inv[aá]lid|n[uú]mero.?inv[aá]lid|dados?.?(do )?cart/i,
    message: `Dados do cartão inválidos. Confira número, validade e CVV, ou use outro cartão.`,
  },
  {
    test: /not.?allowed|n[aã]o.?permit|transaç[aã]o.?n[aã]o.?permit|blocked.?for.?online|compras?.?online/i,
    message: `Este cartão não permite esta compra. Use outro cartão ou finalize com Pix.`,
  },
  {
    test: /blocked|bloquead|restricted|restri/i,
    message: `Cartão bloqueado ou com restrição. Use outro cartão ou finalize com Pix.`,
  },
  {
    test: /fraud|suspeita|antifraud|anti.?fraude/i,
    message: `Pagamento não autorizado por segurança. Use outro cartão ou finalize com Pix.`,
  },
  {
    test: /installment|parcela/i,
    message: `O parcelamento escolhido não é permitido para este cartão. Escolha menos parcelas, outro cartão ou Pix.`,
  },
  {
    test: /timeout|unavailable|indispon|try.?again|tente.?novamente|tempor/i,
    message: `Instabilidade temporária no cartão. Aguarde alguns minutos e tente de novo, ou use Pix.`,
  },
  {
    test: /do.?not.?honor|issuer.?declined|recusa.?do.?banco|n[aã]o.?autoriz|contact.?issuer|contate.?o.?emissor|fale.?com.?o.?banco/i,
    message: `Seu banco não autorizou esta compra. Peça a liberação na central do cartão e tente de novo, ou use outro cartão/Pix.`,
  },
]

function normalizeCode(value: string): string {
  return value.trim().toLowerCase()
}

function isSafeCustomerMessage(text: string): boolean {
  const value = text.trim()
  if (value.length < 8 || value.length > 240) return false
  if (/payoutbr|secret|api error|stack|exception|undefined|null|PAYOUTBR_|sk_live|pk_live/i.test(value)) {
    return false
  }
  return true
}

function withCta(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  if (/outro cart[aã]o|pix|tente de novo|tente novamente/i.test(trimmed)) {
    return trimmed
  }
  return `${trimmed.replace(/[.\s]+$/, '')}. ${CTA}`
}

export function parsePayoutBrRefusedReason(value: unknown): PayoutBrRefusedReason | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const category = typeof record.category === 'string' ? record.category : null
  const acquirerCode =
    typeof record.acquirerCode === 'string'
      ? record.acquirerCode
      : typeof record.acquirer_code === 'string'
        ? record.acquirer_code
        : null
  const description = typeof record.description === 'string' ? record.description : null
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : null
  if (!category && !acquirerCode && !description) return null
  return { category, acquirerCode, description, createdAt }
}

/**
 * Extrai motivo de recusa de um payload da PayoutBR (transação ou corpo de erro).
 */
export function extractPayoutBrRefusedReason(payload: unknown): PayoutBrRefusedReason | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>

  const direct = parsePayoutBrRefusedReason(record.refusedReason ?? record.refused_reason)
  if (direct) return direct

  const data = record.data
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>
    const fromData = parsePayoutBrRefusedReason(nested.refusedReason ?? nested.refused_reason)
    if (fromData) return fromData
    const tx = nested.transaction
    if (tx && typeof tx === 'object') {
      const fromTx = parsePayoutBrRefusedReason(
        (tx as Record<string, unknown>).refusedReason ??
          (tx as Record<string, unknown>).refused_reason
      )
      if (fromTx) return fromTx
    }
  }

  return null
}

export function formatPayoutBrCardRefusedMessage(
  reason?: PayoutBrRefusedReason | null
): string {
  if (!reason) return DEFAULT_CARD_REFUSED_MESSAGE

  const category = reason.category ? normalizeCode(reason.category) : ''
  if (category && CATEGORY_MESSAGES[category]) {
    return CATEGORY_MESSAGES[category]!
  }

  const code = reason.acquirerCode ? normalizeCode(reason.acquirerCode) : ''
  if (code && ACQUIRER_CODE_MESSAGES[code]) {
    return ACQUIRER_CODE_MESSAGES[code]!
  }

  const description = reason.description?.trim() ?? ''
  if (description) {
    for (const rule of DESCRIPTION_RULES) {
      if (rule.test.test(description)) return rule.message
    }
    if (isSafeCustomerMessage(description)) {
      return withCta(description)
    }
  }

  return DEFAULT_CARD_REFUSED_MESSAGE
}

/**
 * Mensagem segura a partir de erro HTTP da PayoutBR (sem vazar detalhe interno).
 * Retorna null quando o erro não deve ser mostrado ao cliente como “recusa de cartão”.
 */
export function formatPayoutBrProviderClientMessage(params: {
  message: string
  status: number
  details?: unknown
}): { code: 'CARD_REFUSED' | 'INVALID_CARD_TOKEN' | 'PAYMENT_PROVIDER_ERROR'; message: string } {
  const refused = extractPayoutBrRefusedReason(params.details)
  if (refused) {
    return { code: 'CARD_REFUSED', message: formatPayoutBrCardRefusedMessage(refused) }
  }

  const raw = params.message.trim()
  const lower = raw.toLowerCase()

  if (
    params.status >= 400 &&
    params.status < 500 &&
    /(card|cart[aã]o|cvv|hash|token|installment|parcela|invalid|inv[aá]lid)/i.test(raw)
  ) {
    if (/(hash|token)/i.test(lower)) {
      return {
        code: 'INVALID_CARD_TOKEN',
        message: 'Não foi possível validar o cartão. Confira os dados e tente novamente.',
      }
    }
    if (isSafeCustomerMessage(raw)) {
      return { code: 'CARD_REFUSED', message: withCta(raw) }
    }
    return {
      code: 'CARD_REFUSED',
      message:
        'Não foi possível autorizar este cartão. Confira os dados, tente outro cartão ou finalize com Pix.',
    }
  }

  return {
    code: 'PAYMENT_PROVIDER_ERROR',
    message:
      'Pagamento com cartão indisponível no momento. Tente novamente em instantes ou finalize com Pix.',
  }
}
