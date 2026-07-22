import { Resend } from 'resend'
import { getSiteUrl } from '@/lib/seo/site-url'

export type OrderConfirmationItem = {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export type OrderConfirmationAddress = {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zip_code: string
}

export type OrderConfirmationEmailInput = {
  orderId: string
  customerEmail: string
  customerName: string | null
  customerPhone?: string | null
  total: number
  subtotal?: number | null
  shippingPrice?: number | null
  discountAmount?: number | null
  shippingMethodName: string | null
  paymentMethod: string | null
  createdAt: string | null
  items?: OrderConfirmationItem[]
  shippingAddress?: OrderConfirmationAddress | null
  logoUrl?: string | null
}

const BRAND = {
  name: 'Batista Cosméticos',
  rose: '#d86487',
  plum: '#4a202a',
  muted: '#6b7280',
  border: '#f1dfdd',
  soft: '#fdf7f6',
  /** Logo hospedada no Resend CDN (estável para clientes de e-mail) */
  logoFallback: 'https://cdn.resend.app/824136f2-cb8c-4566-af9f-e4e96cc3ea97',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function shortOrderId(orderId: string): string {
  return orderId.length > 8 ? orderId.slice(0, 8).toUpperCase() : orderId.toUpperCase()
}

function paymentMethodLabel(value: string | null): string {
  if (!value) return 'Pagamento online'
  if (value === 'pix') return 'Pix'
  if (value === 'credit_card') return 'Cartão de crédito'
  return value
}

function formatAddress(address: OrderConfirmationAddress): string {
  const line1 = [address.street, address.number].filter(Boolean).join(', ')
  const line2 = [address.complement, address.neighborhood].filter(Boolean).join(' — ')
  const line3 = [address.city && address.state ? `${address.city}/${address.state}` : address.city, address.zip_code]
    .filter(Boolean)
    .join(' · ')
  return [line1, line2, line3].filter(Boolean).join('<br/>')
}

function resolveLogoUrl(logoUrl?: string | null): string {
  if (logoUrl?.startsWith('http')) return logoUrl
  return BRAND.logoFallback
}

function buildItemsRows(items: OrderConfirmationItem[]): string {
  if (!items.length) return ''

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3e8e6;font-size:14px;color:#374151;vertical-align:top;">
          ${escapeHtml(item.name)}
          <div style="margin-top:2px;font-size:12px;color:#9ca3af;">Qtd. ${item.quantity}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f3e8e6;font-size:14px;color:#374151;text-align:right;white-space:nowrap;vertical-align:top;">
          ${escapeHtml(formatCurrency(item.subtotal))}
        </td>
      </tr>`
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px 0;">
      <tr>
        <td colspan="2" style="padding:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};">
          Itens do pedido
        </td>
      </tr>
      ${rows}
    </table>`
}

function buildTotalsBlock(input: OrderConfirmationEmailInput): string {
  const lines: Array<{ label: string; value: string; strong?: boolean; accent?: boolean }> = []

  if (input.subtotal != null) {
    lines.push({ label: 'Subtotal', value: formatCurrency(Number(input.subtotal)) })
  }
  if (input.shippingPrice != null) {
    lines.push({
      label: 'Frete',
      value:
        Number(input.shippingPrice) === 0
          ? 'Grátis'
          : formatCurrency(Number(input.shippingPrice)),
    })
  }
  if (Number(input.discountAmount ?? 0) > 0) {
    lines.push({
      label: 'Desconto',
      value: `- ${formatCurrency(Number(input.discountAmount))}`,
      accent: true,
    })
  }
  lines.push({ label: 'Total', value: formatCurrency(input.total), strong: true })

  return lines
    .map(
      (line) => `
      <tr>
        <td style="padding:4px 0;font-size:${line.strong ? '15px' : '13px'};color:${line.strong ? BRAND.plum : BRAND.muted};font-weight:${line.strong ? '700' : '400'};">
          ${escapeHtml(line.label)}
        </td>
        <td style="padding:4px 0;font-size:${line.strong ? '16px' : '13px'};text-align:right;color:${line.accent ? '#059669' : line.strong ? BRAND.rose : '#374151'};font-weight:${line.strong ? '700' : '500'};">
          ${escapeHtml(line.value)}
        </td>
      </tr>`
    )
    .join('')
}

function buildHtml(input: OrderConfirmationEmailInput): string {
  const siteUrl = getSiteUrl() ?? 'https://www.batistacosmeticos.com.br'
  const ordersUrl = `${siteUrl}/conta/pedidos`
  const orderLabel = shortOrderId(input.orderId)
  const customerName = input.customerName?.trim() || 'Cliente'
  const logoUrl = resolveLogoUrl(input.logoUrl)
  const createdAtLabel = input.createdAt
    ? new Date(input.createdAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null
  const items = input.items ?? []
  const addressHtml = input.shippingAddress ? formatAddress(input.shippingAddress) : null

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pedido confirmado</title>
  </head>
  <body style="margin:0;padding:0;background:#faf6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(180deg, ${BRAND.soft} 0%, #ffffff 100%);padding:28px 28px 12px 28px;text-align:center;">
                <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRAND.name)}" width="180" style="display:inline-block;height:auto;max-width:180px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 8px 28px;text-align:center;">
                <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.rose};">
                  Compra confirmada
                </p>
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.3;color:${BRAND.plum};">
                  Parabéns pela sua compra, ${escapeHtml(customerName)}!
                </h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
                  Recebemos seu pagamento e já estamos preparando o pedido com carinho.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 8px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.soft};border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.7;color:#374151;">
                      <strong style="color:${BRAND.plum};">Pedido</strong> #${escapeHtml(orderLabel)}<br/>
                      <strong style="color:${BRAND.plum};">Pagamento</strong> ${escapeHtml(paymentMethodLabel(input.paymentMethod))}<br/>
                      <strong style="color:${BRAND.plum};">Frete</strong> ${escapeHtml(input.shippingMethodName || 'Entrega padrão')}${
                        createdAtLabel
                          ? `<br/><strong style="color:${BRAND.plum};">Data</strong> ${escapeHtml(createdAtLabel)}`
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 4px 28px;">
                ${buildItemsRows(items)}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 8px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${buildTotalsBlock(input)}
                </table>
              </td>
            </tr>
            ${
              addressHtml
                ? `<tr>
              <td style="padding:12px 28px 4px 28px;">
                <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};">
                  Endereço de entrega
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  ${addressHtml}
                </p>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:22px 28px 8px 28px;text-align:center;">
                <a href="${escapeHtml(ordersUrl)}" style="display:inline-block;background:${BRAND.rose};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:999px;">
                  Acompanhar meu pedido
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 28px 28px;text-align:center;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                  Você receberá o código de rastreio por e-mail assim que o pedido for enviado.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  Dúvidas? Fale com a gente em
                  <a href="mailto:atendimento@batistacosmeticos.com.br" style="color:${BRAND.rose};text-decoration:none;">atendimento@batistacosmeticos.com.br</a>
                  <br/>
                  <a href="${escapeHtml(siteUrl)}" style="color:${BRAND.muted};text-decoration:none;">www.batistacosmeticos.com.br</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildText(input: OrderConfirmationEmailInput): string {
  const orderLabel = shortOrderId(input.orderId)
  const customerName = input.customerName?.trim() || 'Cliente'
  const lines = [
    `Parabéns pela sua compra, ${customerName}!`,
    '',
    `Pedido #${orderLabel} confirmado.`,
    `Total: ${formatCurrency(input.total)}`,
    `Pagamento: ${paymentMethodLabel(input.paymentMethod)}`,
    `Frete: ${input.shippingMethodName || 'Entrega padrão'}`,
    '',
  ]

  if (input.items?.length) {
    lines.push('Itens:')
    for (const item of input.items) {
      lines.push(`- ${item.name} x${item.quantity}: ${formatCurrency(item.subtotal)}`)
    }
    lines.push('')
  }

  lines.push(
    'Você receberá o código de rastreio por e-mail assim que o pedido for enviado.',
    '',
    'Acompanhe em: https://www.batistacosmeticos.com.br/conta/pedidos',
    'Atendimento: atendimento@batistacosmeticos.com.br'
  )

  return lines.join('\n')
}

export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput
): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false, reason: 'missing_api_key' }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'Batista Cosméticos <atendimento@batistacosmeticos.com.br>'
  const resend = new Resend(apiKey)

  const subject = `Parabéns pela compra — Pedido #${shortOrderId(input.orderId)} | Batista Cosméticos`
  const html = buildHtml(input)
  const text = buildText(input)

  const { error } = await resend.emails.send({
    from,
    to: [input.customerEmail],
    replyTo: 'atendimento@batistacosmeticos.com.br',
    subject,
    html,
    text,
  })

  if (error) {
    return { ok: false, reason: error.message }
  }

  return { ok: true }
}
