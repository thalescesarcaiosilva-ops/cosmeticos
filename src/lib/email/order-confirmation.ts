import { Resend } from 'resend'
import { getSiteUrl } from '@/lib/seo/site-url'

type OrderConfirmationEmailInput = {
  orderId: string
  customerEmail: string
  customerName: string | null
  total: number
  shippingMethodName: string | null
  paymentMethod: string | null
  createdAt: string | null
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

function buildHtml(input: OrderConfirmationEmailInput): string {
  const siteUrl = getSiteUrl()
  const ordersUrl = siteUrl ? `${siteUrl}/conta/pedidos` : null
  const orderLabel = shortOrderId(input.orderId)
  const customerName = input.customerName?.trim() || 'Cliente'
  const createdAtLabel = input.createdAt
    ? new Date(input.createdAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pedido confirmado</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #f1dfdd;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <img src="https://cdn.resend.app/824136f2-cb8c-4566-af9f-e4e96cc3ea97" alt="Batista Cosméticos" width="191" style="display:block;height:auto;max-width:100%;" />
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px 24px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#4a202a;">Parabéns pela sua compra, ${escapeHtml(customerName)}!</h1>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#4b5563;">
                  Recebemos seu pedido e já estamos preparando tudo com carinho.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#4b5563;">
                  Você vai receber o <strong>código de rastreio</strong> por e-mail assim que o pedido for enviado.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #e5e7eb;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#374151;">
                      <strong>Pedido:</strong> #${escapeHtml(orderLabel)}<br/>
                      <strong>Total:</strong> ${escapeHtml(formatCurrency(input.total))}<br/>
                      <strong>Pagamento:</strong> ${escapeHtml(paymentMethodLabel(input.paymentMethod))}<br/>
                      <strong>Frete:</strong> ${escapeHtml(input.shippingMethodName || 'Entrega padrão')}${createdAtLabel ? `<br/><strong>Data:</strong> ${escapeHtml(createdAtLabel)}` : ''}
                    </td>
                  </tr>
                </table>

                ${
                  ordersUrl
                    ? `<p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#4b5563;">Acompanhe o andamento em <a href="${escapeHtml(ordersUrl)}" style="color:#d86487;text-decoration:none;">Meus pedidos</a>.</p>`
                    : ''
                }

                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  Esta é uma mensagem automática da Batista Cosméticos.
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
  return [
    `Parabéns pela sua compra, ${customerName}!`,
    '',
    `Pedido #${orderLabel} confirmado.`,
    `Total: ${formatCurrency(input.total)}`,
    `Pagamento: ${paymentMethodLabel(input.paymentMethod)}`,
    `Frete: ${input.shippingMethodName || 'Entrega padrão'}`,
    '',
    'Você receberá o código de rastreio por e-mail assim que o pedido for enviado.',
  ].join('\n')
}

export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput
): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false, reason: 'missing_api_key' }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Batista Cosméticos <onboarding@resend.dev>'
  const resend = new Resend(apiKey)

  const subject = `Pedido confirmado na Batista Cosméticos (#${shortOrderId(input.orderId)})`
  const html = buildHtml(input)
  const text = buildText(input)

  const { error } = await resend.emails.send({
    from,
    to: [input.customerEmail],
    subject,
    html,
    text,
  })

  if (error) {
    return { ok: false, reason: error.message }
  }

  return { ok: true }
}
