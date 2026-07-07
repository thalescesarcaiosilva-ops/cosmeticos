import { parseCsv } from '@/lib/csv/parse-csv'

export type ProductReviewCsvRow = {
  authorName: string
  authorEmail: string | null
  rating: number
  title: string | null
  comment: string
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function pickColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => normalizeHeader(h))
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias))
    if (index >= 0) return index
  }
  return -1
}

function asNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parseProductReviewsCsv(text: string): ProductReviewCsvRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const header = rows[0] ?? []
  const idxName = pickColumnIndex(header, ['nome', 'name', 'autor', 'author'])
  const idxEmail = pickColumnIndex(header, ['email', 'e-mail'])
  const idxRating = pickColumnIndex(header, ['nota', 'rating', 'avaliacao', 'avaliacao_nota'])
  const idxTitle = pickColumnIndex(header, ['titulo', 'title', 'assunto'])
  const idxComment = pickColumnIndex(header, ['comentario', 'comentário', 'review', 'mensagem'])

  if (idxName < 0 || idxRating < 0 || idxComment < 0) return []

  const parsed: ProductReviewCsvRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const name = (row[idxName] ?? '').trim()
    const comment = (row[idxComment] ?? '').trim()
    if (!name || !comment) continue

    const ratingRaw = (row[idxRating] ?? '').trim().replace(',', '.')
    const rating = Number.parseFloat(ratingRaw)
    if (!Number.isFinite(rating)) continue

    const roundedRating = Math.max(1, Math.min(5, Math.round(rating)))
    parsed.push({
      authorName: name.slice(0, 120),
      authorEmail: idxEmail >= 0 ? asNullableText(row[idxEmail] ?? '') : null,
      rating: roundedRating,
      title: idxTitle >= 0 ? asNullableText(row[idxTitle] ?? '') : null,
      comment: comment.slice(0, 1500),
    })
  }

  return parsed
}
