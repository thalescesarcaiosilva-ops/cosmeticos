import { formatCurrency } from '@/lib/products/format'

export function shortOrderNumber(orderId: string): string {
  return orderId.length > 8 ? orderId.slice(0, 8).toUpperCase() : orderId.toUpperCase()
}

export function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/)[0] ?? ''
  if (!token || token.toLowerCase() === 'cliente') return ''
  return token
}

/** Telefone brasileiro com código do país, só dígitos. Null se não der para ligar. */
export function toBrazilPhoneDigits(raw: string | null | undefined): string | null {
  let digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return null
}

export function formatBrazilPhone(raw: string | null | undefined): string | null {
  const digits = toBrazilPhoneDigits(raw)
  if (!digits) return null
  const local = digits.slice(2)
  if (local.length === 11) {
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }
  return `+${digits}`
}

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value?.trim()) return 'Não informada'
  if (value === 'pix') return 'Pix'
  if (value === 'credit_card') return 'Cartão de crédito'
  if (value === 'boleto') return 'Boleto'
  return value
}

export function buildSupportWhatsappMessage(input: {
  customerName: string
  storeName: string
  orderNumber: string
  total: number
  cancelled: boolean
}): string {
  const name = firstName(input.customerName)
  const greeting = name ? `Olá ${name}` : 'Olá'
  const totalLabel = formatCurrency(input.total)
  const detail = input.cancelled
    ? `Seu pedido ${input.orderNumber}, no valor de ${totalLabel}, foi cancelado antes do pagamento.`
    : `O pagamento do pedido ${input.orderNumber}, no valor de ${totalLabel}, ainda não foi confirmado.`
  return `${greeting}, aqui é o atendimento da ${input.storeName}. ${detail} Posso te ajudar a concluir a compra?`
}

export function whatsappUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
}
