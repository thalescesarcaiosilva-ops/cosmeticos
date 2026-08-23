/**
 * Converte e-mails em texto/HTML de políticas em links mailto clicáveis.
 */
export function linkifyEmailsInHtml(html: string): string {
  const parts = html.split(/(<[^>]+>)/g)
  let insideAnchor = 0

  return parts
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<a\b/i.test(part)) {
          insideAnchor++
          return part.replace(
            /href=(["'])(?!mailto:)([^"']*@[^"']*)\1/i,
            'href=$1mailto:$2$1'
          )
        }
        if (/^<\/a>/i.test(part)) {
          insideAnchor = Math.max(0, insideAnchor - 1)
        }
        return part
      }

      if (insideAnchor > 0) return part

      return part.replace(
        /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
        '<a href="mailto:$1">$1</a>'
      )
    })
    .join('')
}
