import { serveFaviconResponse } from '@/lib/seo/serve-favicon'

export const revalidate = 60

/** Browsers pedem /favicon.ico por padrão — serve o mesmo favicon do admin. */
export async function GET() {
  return serveFaviconResponse()
}
