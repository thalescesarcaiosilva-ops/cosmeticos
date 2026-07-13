const BLOCKED_HOSTS = ['karlacosmeticos.com', 'www.karlacosmeticos.com']
const ALLOWED_HOSTS = ['epocacosmeticos.vteximg.com.br', 'vteximg.com.br']

export function isBlockedImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
  } catch {
    return true
  }
}

export function isAllowedImageUrl(url: string): boolean {
  if (!url || isBlockedImageUrl(url)) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export function filterImportableImages<T extends { url: string }>(images: T[]): T[] {
  return images.filter((image) => isAllowedImageUrl(image.url))
}

export function sourceFilenameFromUrl(sourceUrl: string): string {
  return sourceUrl.split('/').pop()?.split('?')[0] ?? 'import.webp'
}
