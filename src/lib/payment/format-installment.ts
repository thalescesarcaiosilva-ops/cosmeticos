import { formatCurrency } from '@/lib/products/format'

export type InstallmentTemplatePart =
  | { type: 'text'; text: string }
  | { type: 'count' }
  | { type: 'value' }

export function applyInstallmentTemplate(
  template: string,
  count: number,
  value: number
): string {
  return template
    .replace(/\{count\}/gi, String(count))
    .replace(/\{value\}/gi, formatCurrency(value))
}

export function splitInstallmentTemplate(template: string): InstallmentTemplatePart[] {
  const parts: InstallmentTemplatePart[] = []
  const re = /\{(count|value)\}/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: template.slice(lastIndex, match.index) })
    }
    parts.push({ type: match[1].toLowerCase() === 'count' ? 'count' : 'value' })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < template.length) {
    parts.push({ type: 'text', text: template.slice(lastIndex) })
  }

  return parts
}
