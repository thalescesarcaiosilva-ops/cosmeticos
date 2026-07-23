import { Resend } from 'resend'

export type ContactReplyEmailInput = {
  toEmail: string
  toName: string
  subject: string
  originalMessage: string
  replyBody: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendContactReplyEmail(
  input: ContactReplyEmailInput
): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false, reason: 'missing_api_key' }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'Batista Cosméticos <atendimento@batistacosmeticos.com.br>'
  const replyTo =
    process.env.RESEND_REPLY_TO?.trim() ||
    process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ||
    'atendimento@batistacosmeticos.com.br'

  const resend = new Resend(apiKey)
  const subject = input.subject.toLowerCase().startsWith('re:')
    ? input.subject
    : `Re: ${input.subject}`

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;">
      <p>Olá ${escapeHtml(input.toName)},</p>
      <div style="white-space:pre-wrap;">${escapeHtml(input.replyBody)}</div>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="color:#666;font-size:12px;">Sua mensagem original:</p>
      <blockquote style="margin:0;padding:12px;background:#f7f7f7;border-left:3px solid #ccc;white-space:pre-wrap;color:#444;">
        ${escapeHtml(input.originalMessage)}
      </blockquote>
      <p style="margin-top:24px;color:#666;font-size:12px;">Batista Cosméticos</p>
    </div>
  `

  const text = `Olá ${input.toName},\n\n${input.replyBody}\n\n---\nSua mensagem original:\n${input.originalMessage}\n\nBatista Cosméticos`

  const { error } = await resend.emails.send({
    from,
    to: [input.toEmail],
    replyTo,
    subject,
    html,
    text,
  })

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
