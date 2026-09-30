import { STORE_WHATSAPP_DISPLAY, STORE_WHATSAPP_HREF } from '@/components/layout/StoreWhatsappLink'
import { linkifyEmailsInHtml } from '@/lib/content/linkify-emails'
import { toPublicHref } from '@/lib/navigation/public-href'

/** Prepara HTML de políticas: mailto em e-mails e links internos absolutos. */
export function preparePolicyHtml(
  html: string,
  options?: { mutePhone?: string | null }
): string {
  const withEmails = linkifyEmailsInHtml(html)
  const withLinks = withEmails.replace(/href=(["'])(\/[^"'#][^"']*)\1/g, (_, quote, path) => {
    return `href=${quote}${toPublicHref(path)}${quote}`
  })
  return placeWhatsappBeforePhone(withLinks, options?.mutePhone)
}

function placeWhatsappBeforePhone(html: string, phoneDisplay: string | null | undefined): string {
  const phone = phoneDisplay?.trim()
  if (!phone) return html

  const escaped = phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const withLabel = new RegExp(
    `(?:\\s*[·•]\\s*)?(?:<strong>\\s*)?(?:Telefone|telefone)\\s*:?\\s*(?:</strong>)?\\s*(?:<strong>\\s*)?${escaped}(?:\\s*</strong>)?`,
    'gi'
  )
  const numberOnly = new RegExp(`<strong>\\s*${escaped}\\s*</strong>|${escaped}`, 'g')
  const token = '%%POLICY_PHONE%%'
  const whatsapp = `<strong>WhatsApp:</strong> <a href="${STORE_WHATSAPP_HREF}">${STORE_WHATSAPP_DISPLAY}</a>`
  const phoneLine = `<br><span class="text-xs font-normal text-text-muted">Telefone: ${token}</span>`
  const mutedNumber = `<span class="text-xs font-normal text-text-muted">${phone}</span>`

  let added = false
  const marked = html.replace(withLabel, () => {
    if (added) return phoneLine
    added = true
    return `${whatsapp}${phoneLine}`
  })

  const withMuted = marked.replace(numberOnly, () => {
    if (added) return mutedNumber
    added = true
    return `${whatsapp}${phoneLine}`
  })

  return withMuted.replaceAll(token, phone)
}
