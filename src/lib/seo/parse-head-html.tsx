import type { CSSProperties, ReactElement } from 'react'

const SITE_TAG_PATTERN =
  /<(?:script|noscript|meta|link|style|iframe)\b[\s\S]*?(?:\/>|>[\s\S]*?<\/(?:script|noscript|style|iframe)>)/gi

function parseAttributes(tag: string): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {}
  const inner = tag.match(/^<\w+\s*([\s\S]*?)(?:\/?>|>)/)?.[1] ?? ''

  const attrPattern = /([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let match: RegExpExecArray | null

  while ((match = attrPattern.exec(inner))) {
    const name = match[1]!
    const value = match[2] ?? match[3] ?? match[4]
    attrs[name] = value ?? true
  }

  return attrs
}

function attrsToProps(attrs: Record<string, string | boolean>) {
  const props: Record<string, string | boolean> = {}

  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'charset') {
      props.charSet = String(value)
      continue
    }

    if (name === 'class') {
      props.className = String(value)
      continue
    }

    if (value === true) {
      props[name] = true
      continue
    }

    props[name] = value
  }

  return props
}

function renderIframe(tag: string, key: number): ReactElement | null {
  const attrs = parseAttributes(tag)
  if (typeof attrs.src !== 'string' || !attrs.src.trim()) return null

  const height = typeof attrs.height === 'string' ? attrs.height : '0'
  const width = typeof attrs.width === 'string' ? attrs.width : '0'
  const title = typeof attrs.title === 'string' ? attrs.title : 'Tag tracking'
  const rawStyle = typeof attrs.style === 'string' ? attrs.style : 'display:none;visibility:hidden'

  return (
    <iframe
      key={key}
      src={attrs.src}
      height={height}
      width={width}
      title={title}
      style={parseInlineStyle(rawStyle)}
      {...(typeof attrs.id === 'string' ? { id: attrs.id } : {})}
    />
  )
}

function parseInlineStyle(raw: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const [prop, ...rest] = part.split(':')
    if (!prop || rest.length === 0) continue
    const cssProp = prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    style[cssProp] = rest.join(':').trim()
  }
  return style as CSSProperties
}

function renderTag(tag: string, key: number): ReactElement | null {
  const lower = tag.trim().toLowerCase()

  if (lower.startsWith('<script')) {
    const attrs = parseAttributes(tag)
    const inline = tag.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1]

    if (typeof attrs.src === 'string') {
      return (
        <script
          key={key}
          src={attrs.src}
          async={attrs.async === true ? true : undefined}
          defer={attrs.defer === true ? true : undefined}
          {...(typeof attrs.type === 'string' ? { type: attrs.type } : {})}
          {...(typeof attrs.id === 'string' ? { id: attrs.id } : {})}
        />
      )
    }

    if (inline?.trim()) {
      return <script key={key} dangerouslySetInnerHTML={{ __html: inline }} />
    }

    return null
  }

  if (lower.startsWith('<noscript')) {
    const inner = tag.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/i)?.[1]
    if (!inner?.trim()) return null

    const iframeMatch = inner.match(/<iframe\b[\s\S]*?(?:\/>|>[\s\S]*?<\/iframe>)/i)
    if (iframeMatch) {
      const iframe = renderIframe(iframeMatch[0], key)
      if (!iframe) return null
      return <noscript key={key}>{iframe}</noscript>
    }

    return <noscript key={key} dangerouslySetInnerHTML={{ __html: inner }} />
  }

  if (lower.startsWith('<iframe')) {
    return renderIframe(tag, key)
  }

  if (lower.startsWith('<meta')) {
    return <meta key={key} {...attrsToProps(parseAttributes(tag))} />
  }

  if (lower.startsWith('<link')) {
    return <link key={key} {...attrsToProps(parseAttributes(tag))} />
  }

  if (lower.startsWith('<style')) {
    const css = tag.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]
    if (!css?.trim()) return null
    return <style key={key} dangerouslySetInnerHTML={{ __html: css }} />
  }

  return null
}

/** Converte HTML de tags (script/meta/link/style/noscript/iframe) em nós React. */
export function parseSiteHtml(html: string): ReactElement[] {
  const trimmed = html.trim()
  if (!trimmed) return []

  const tags = trimmed.match(SITE_TAG_PATTERN) ?? []
  const nodes: ReactElement[] = []

  tags.forEach((tag, index) => {
    const node = renderTag(tag, index)
    if (node) nodes.push(node)
  })

  return nodes
}

/** @deprecated Use parseSiteHtml */
export function parseHeadHtml(html: string): ReactElement[] {
  return parseSiteHtml(html)
}
