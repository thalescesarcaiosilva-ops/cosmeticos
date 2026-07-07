import type { ReactElement } from 'react'

const HEAD_TAG_PATTERN =
  /<(?:script|meta|link|style)\b[\s\S]*?(?:\/>|>[\s\S]*?<\/(?:script|style)>)/gi

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

    if (value === true) {
      props[name] = true
      continue
    }

    props[name] = value
  }

  return props
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

export function parseHeadHtml(html: string): ReactElement[] {
  const trimmed = html.trim()
  if (!trimmed) return []

  const tags = trimmed.match(HEAD_TAG_PATTERN) ?? []
  const nodes: ReactElement[] = []

  tags.forEach((tag, index) => {
    const node = renderTag(tag, index)
    if (node) nodes.push(node)
  })

  return nodes
}
