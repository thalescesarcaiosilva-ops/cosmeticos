import { serveFaviconResponse } from '@/lib/seo/serve-favicon'

export const revalidate = 60

/** Substitui o favicon padrão do Next.js pelo configurado no admin. */
export default async function Icon() {
  return serveFaviconResponse()
}

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
