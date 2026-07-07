import { parseHeadHtml } from '@/lib/seo/parse-head-html'

type HeadScriptsProps = {
  html: string | null | undefined
}

export function HeadScripts({ html }: HeadScriptsProps) {
  const nodes = parseHeadHtml(html ?? '')
  if (nodes.length === 0) return null
  return <>{nodes}</>
}
