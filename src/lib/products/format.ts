export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function calcDiscountPercent(price: number, originalPrice: number | null): number | null {
  if (originalPrice == null || originalPrice <= price) return null
  return Math.round(((originalPrice - price) / originalPrice) * 100)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
