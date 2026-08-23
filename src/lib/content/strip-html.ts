/** Remove tags HTML e normaliza espaços — útil para feeds e JSON-LD. */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
