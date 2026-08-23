import { linkifyEmailsInHtml } from '@/lib/content/linkify-emails'
import { toPublicHref } from '@/lib/navigation/public-href'

/** Prepara HTML de políticas: mailto em e-mails e links internos absolutos. */
export function preparePolicyHtml(html: string): string {
  const withEmails = linkifyEmailsInHtml(html)
  return withEmails.replace(/href=(["'])(\/[^"'#][^"']*)\1/g, (_, quote, path) => {
    return `href=${quote}${toPublicHref(path)}${quote}`
  })
}
