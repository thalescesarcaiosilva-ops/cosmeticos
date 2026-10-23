/** Remove acentos e normaliza para comparação de busca (case-insensitive). */
export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Escapa curingas do operador SQL LIKE (`%`, `_`, `\`). */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}

export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}

const SEARCH_STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'um',
  'uma',
  'para',
  'com',
  'por',
  'ao',
  'aos',
  'na',
  'no',
  'nas',
  'nos',
  'as',
  'os',
  'ou',
  'que',
  'pra',
])

/** Palavras úteis da busca. "guarda-roupa preto" vira guarda, roupa, preto. */
export function searchTokens(query: string): string[] {
  const normalized = normalizeSearchText(query.replace(/[-/]/g, ' '))
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !SEARCH_STOPWORDS.has(token))
  return [...new Set(tokens)].slice(0, 6)
}
