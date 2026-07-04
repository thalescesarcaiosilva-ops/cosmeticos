/** Parser CSV RFC-style (campos entre aspas, quebras de linha dentro de células). */
export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]
    if (quoted) {
      if (c === '"' && normalized[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        cur += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && normalized[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else {
      cur += c
    }
  }

  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}
