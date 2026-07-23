import { Resend } from 'resend'
import { getSiteUrl } from '@/lib/seo/site-url'

export type OrderShippedEmailInput = {
  orderId: string
  customerEmail: string
  customerName: string | null
  trackingCode: string
  shippingMethodName?: string | null
  destinationCity?: string | null
  destinationState?: string | null
  logoUrl?: string | null
}

const BRAND = {
  name: 'Batista Cosméticos',
  rose: '#d86487',
  plum: '#4a202a',
  muted: '#6b7280',
  border: '#f1dfdd',
  soft: '#fdf7f6',
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

function shortOrderId(orderId: string): string {
  return orderId.length > 8 ? orderId.slice(0, 8).toUpperCase() : orderId.toUpperCase()
}

function resolveLogoUrl(logoUrl?: string | null): string {
  if (logoUrl?.startsWith('http')) return logoUrl
  return BRAND.logoFallback
}

function buildHtml(input: OrderShippedEmailInput): string {
  const siteUrl = getSiteUrl() ?? 'https://www.batistacosmeticos.com.br'
  const trackingUrl = `${siteUrl}/paginas/rastreio?codigo=${encodeURIComponent(input.trackingCode)}`
  const ordersUrl = `${siteUrl}/conta/pedidos`
  const orderLabel = shortOrderId(input.orderId)
  const customerName = input.customerName?.trim() || 'Cliente'
  const logoUrl = resolveLogoUrl(input.logoUrl)
  const destination =
    input.destinationCity && input.destinationState
      ? `${input.destinationCity}/${input.destinationState}`
      : input.destinationCity || null

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pedido enviado</title>
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
                  Pedido enviado
                </p>
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.3;color:${BRAND.plum};">
                  Seu pedido já está a caminho, ${escapeHtml(customerName)}!
                </h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
                  Geramos o código de rastreio para você acompanhar a entrega.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 8px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.soft};border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.7;color:#374151;">
                      <strong style="color:${BRAND.plum};">Pedido</strong> #${escapeHtml(orderLabel)}<br/>
                      <strong style="color:${BRAND.plum};">Código de rastreio</strong>
                      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.04em;">
                        ${escapeHtml(input.trackingCode)}
                      </span>
                      ${
                        input.shippingMethodName
                          ? `<br/><strong style="color:${BRAND.plum};">Frete</strong> ${escapeHtml(input.shippingMethodName)}`
                          : ''
                      }
                      ${
                        destination
                          ? `<br/><strong style="color:${BRAND.plum};">Destino</strong> ${escapeHtml(destination)}`
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 8px 28px;text-align:center;">
                <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:${BRAND.rose};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:999px;">
                  Rastrear pedido
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 28px 28px;text-align:center;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                  Acesse também <a href="${escapeHtml(ordersUrl)}" style="color:${BRAND.rose};text-decoration:none;">Meus pedidos</a>
                  ou use o código na página de rastreio da loja.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  Dúvidas? Fale com a gente em
                  <a href="mailto:atendimento@batistacosmeticos.com.br" style="color:${BRAND.rose};text-decoration:none;">atendimento@batistacosmeticos.com.br</a>
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

function buildText(input: OrderShippedEmailInput): string {
  const siteUrl = getSiteUrl() ?? 'https://www.batistacosmeticos.com.br'
  const customerName = input.customerName?.trim() || 'Cliente'
  return [
    `Olá, ${customerName}!`,
    '',
    `Seu pedido #${shortOrderId(input.orderId)} foi enviado.`,
    `Código de rastreio: ${input.trackingCode}`,
    '',
    `Acompanhe em: ${siteUrl}/paginas/rastreio?codigo=${input.trackingCode}`,
    `Ou em: ${siteUrl}/conta/pedidos`,
    '',
    'Atendimento: atendimento@batistacosmeticos.com.br',
  ].join('\n')
}

export async function sendOrderShippedEmail(
  input: OrderShippedEmailInput
): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false, reason: 'missing_api_key' }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'Batista Cosméticos <atendimento@batistacosmeticos.com.br>'
  const resend = new Resend(apiKey)

  const subject = `Pedido enviado — Rastreio ${input.trackingCode} | Batista Cosméticos`
  const { error } = await resend.emails.send({
    from,
    to: [input.customerEmail],
    replyTo: 'atendimento@batistacosmeticos.com.br',
    subject,
    html: buildHtml(input),
    text: buildText(input),
  })

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
