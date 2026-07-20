import { parseSiteHtml } from '@/lib/seo/parse-head-html'

type SiteHtmlSnippetsProps = {
  html: string | null | undefined
}

/** Injeta snippets HTML permitidos (script/meta/link/style/noscript/iframe). */
export function SiteHtmlSnippets({ html }: SiteHtmlSnippetsProps) {
  const nodes = parseSiteHtml(html ?? '')
  if (nodes.length === 0) return null
  return <>{nodes}</>
}

/** @deprecated Prefer SiteHtmlSnippets */
export function HeadScripts({ html }: SiteHtmlSnippetsProps) {
  return <SiteHtmlSnippets html={html} />
}
