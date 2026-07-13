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
