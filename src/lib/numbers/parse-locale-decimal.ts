/** Converte números em formato pt-BR (ex.: 23,40 ou 1.234,56) para número JS. */
export function parseLocaleDecimal(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return Number.NaN

  if (trimmed.includes(',')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    return Number.parseFloat(normalized)
  }

  return Number.parseFloat(trimmed)
}
