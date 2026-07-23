import { filterStorefrontCategories } from '@/lib/categories/storefront'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'
import { getPrimaryProductImage } from '@/lib/products/product-images'
import { createPublicClient, isSupabasePublicConfigured } from '@/lib/supabase/public'
import { absoluteUrl, getSiteUrl } from '@/lib/seo/site-url'

export const SITEMAP_REVALIDATE_SECONDS = 3600

/** Máximo de URLs por arquivo (limite do protocolo sitemap). */
export const SITEMAP_MAX_URLS = 50_000

export type SitemapChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export type SitemapImage = {
  loc: string
  title?: string
}

export type SitemapUrl = {
  path: string
  lastModified?: Date
  changeFrequency?: SitemapChangeFrequency
  priority?: number
  images?: SitemapImage[]
}

export type SitemapUrlGroup = {
  pages: SitemapUrl[]
  products: SitemapUrl[]
  collections: SitemapUrl[]
}

export type SitemapIndexEntry = {
  path: string
  lastModified?: Date
}

export const SITEMAP_CHILD_PATHS = {
  pages: '/sitemap-pages.xml',
  products: '/sitemap-products.xml',
  collections: '/sitemap-collections.xml',
} as const

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatLastmod(date: Date): string {
  return date.toISOString()
}

function formatPriority(priority: number): string {
  return priority.toFixed(1)
}

function maxLastModified(urls: SitemapUrl[]): Date | undefined {
  let latest: Date | undefined
  for (const url of urls) {
    if (!url.lastModified) continue
    if (!latest || url.lastModified > latest) latest = url.lastModified
  }
  return latest
}

function mergePages(staticPages: SitemapUrl[], dbPages: SitemapUrl[]): SitemapUrl[] {
  const byPath = new Map<string, SitemapUrl>()
  for (const page of staticPages) byPath.set(page.path, page)
  for (const page of dbPages) byPath.set(page.path, page)
  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * URLs garantidas: a home + páginas institucionais fixas (Quem somos, Fale
 * conosco). As demais páginas institucionais/políticas vêm de footer_pages.
 * Todas seguem o padrão único de prefixo /paginas/*.
 */
export function getStaticSitemapUrls(now = new Date()): SitemapUrl[] {
  return [
    {
      path: '/',
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      path: '/paginas/quem-somos',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      path: '/paginas/fale-conosco',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      path: '/paginas/rastreio',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
}

async function fetchSupabaseProductUrls(now: Date): Promise<SitemapUrl[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('products')
    .select(
      'slug, name, updated_at, product_images(sort_order, media:media_assets(public_url, alt_text))'
    )
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(SITEMAP_MAX_URLS)

  const urls: SitemapUrl[] = []

  for (const product of data ?? []) {
    const primary = getPrimaryProductImage(product.product_images, product.name)
    const primaryImageUrl = toAbsoluteSiteMediaUrl(primary.url)
    const images =
      primaryImageUrl != null
        ? [{ loc: primaryImageUrl, ...(primary.alt ? { title: primary.alt } : {}) }]
        : undefined

    urls.push({
      path: `/produto/${product.slug}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      changeFrequency: 'weekly',
      priority: 0.9,
      images,
    })
  }

  return urls
}

async function fetchSupabaseCollectionUrls(now: Date): Promise<SitemapUrl[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('slug, created_at')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(SITEMAP_MAX_URLS)

  return filterStorefrontCategories(data ?? []).map((category) => ({
    path: `/colecoes/${category.slug}`,
    lastModified: category.created_at ? new Date(category.created_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
}

async function fetchSupabasePageUrls(now: Date): Promise<SitemapUrl[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('footer_pages')
    .select('slug, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(SITEMAP_MAX_URLS)

  return (data ?? []).map((page) => ({
    path: `/paginas/${page.slug}`,
    lastModified: page.updated_at ? new Date(page.updated_at) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))
}

/** Busca URLs dinâmicas no Supabase (produtos, coleções, páginas CMS). */
export async function fetchSupabaseSitemapUrls(now = new Date()): Promise<SitemapUrlGroup> {
  if (!isSupabasePublicConfigured()) {
    return { pages: [], products: [], collections: [] }
  }

  const [products, collections, pages] = await Promise.all([
    fetchSupabaseProductUrls(now),
    fetchSupabaseCollectionUrls(now),
    fetchSupabasePageUrls(now),
  ])

  return { pages, products, collections }
}

/** Agrega estáticas + Supabase, deduplicando páginas pelo path. */
export async function collectSitemapUrls(now = new Date()): Promise<SitemapUrl[]> {
  const staticPages = getStaticSitemapUrls(now)
  const fromDb = await fetchSupabaseSitemapUrls(now)

  const pages = mergePages(staticPages, fromDb.pages)
  return [...pages, ...fromDb.products, ...fromDb.collections]
}

/** Agrupa URLs por tipo (para sitemap index estilo WordPress). */
export async function collectSitemapUrlsByType(now = new Date()): Promise<SitemapUrlGroup> {
  const staticPages = getStaticSitemapUrls(now)
  const fromDb = await fetchSupabaseSitemapUrls(now)

  return {
    pages: mergePages(staticPages, fromDb.pages),
    products: fromDb.products,
    collections: fromDb.collections,
  }
}

export function buildSitemapIndexEntries(group: SitemapUrlGroup): SitemapIndexEntry[] {
  const entries: SitemapIndexEntry[] = []

  if (group.pages.length > 0) {
    entries.push({
      path: SITEMAP_CHILD_PATHS.pages,
      lastModified: maxLastModified(group.pages),
    })
  }

  if (group.products.length > 0) {
    entries.push({
      path: SITEMAP_CHILD_PATHS.products,
      lastModified: maxLastModified(group.products),
    })
  }

  if (group.collections.length > 0) {
    entries.push({
      path: SITEMAP_CHILD_PATHS.collections,
      lastModified: maxLastModified(group.collections),
    })
  }

  return entries
}

export function buildSitemapXml(urls: SitemapUrl[], siteUrl?: string | null): string {
  const base = siteUrl ?? getSiteUrl()
  const hasImages = urls.some((url) => url.images && url.images.length > 0)
  const urlsetAttrs = hasImages
    ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

  const body = urls
    .map((entry) => {
      const loc = absoluteUrl(entry.path, base)
      if (!loc) return ''

      const parts = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`]

      if (entry.lastModified) {
        parts.push(`    <lastmod>${escapeXml(formatLastmod(entry.lastModified))}</lastmod>`)
      }
      if (entry.changeFrequency) {
        parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`)
      }
      if (entry.priority != null) {
        parts.push(`    <priority>${formatPriority(entry.priority)}</priority>`)
      }

      for (const image of entry.images ?? []) {
        parts.push('    <image:image>')
        parts.push(`      <image:loc>${escapeXml(image.loc)}</image:loc>`)
        if (image.title) {
          parts.push(`      <image:title>${escapeXml(image.title)}</image:title>`)
        }
        parts.push('    </image:image>')
      }

      parts.push('  </url>')
      return parts.join('\n')
    })
    .filter(Boolean)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${urlsetAttrs}>\n${body}\n</urlset>\n`
}

export function buildSitemapIndexXml(
  entries: SitemapIndexEntry[],
  siteUrl?: string | null
): string {
  const base = siteUrl ?? getSiteUrl()
  const body = entries
    .map((entry) => {
      const loc = absoluteUrl(entry.path, base)
      if (!loc) return ''

      const parts = [`  <sitemap>`, `    <loc>${escapeXml(loc)}</loc>`]
      if (entry.lastModified) {
        parts.push(`    <lastmod>${escapeXml(formatLastmod(entry.lastModified))}</lastmod>`)
      }
      parts.push('  </sitemap>')
      return parts.join('\n')
    })
    .filter(Boolean)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`
}

/**
 * robots.txt: libera o conteúdo público e bloqueia áreas privadas/transacionais.
 *
 * IMPORTANTE (Google Search Central): robots.txt controla RASTREAMENTO, não
 * indexação. Não resolve duplicata — use rel=canonical (lib/seo/canonical.ts)
 * e noindex nas páginas. Não bloqueie /produto/, /colecoes/, /paginas/ nem
 * assets — o Merchant Center precisa rastrear PDPs e políticas.
 *
 * UTM e filtros: preferir canonical + noindex; Disallow de query params é
 * opcional e pouco útil em lojas médias.
 */
export function buildRobotsTxt(siteUrl: string | null = getSiteUrl()): string {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Áreas privadas e transacionais (sem valor de busca)',
  ]

  for (const path of [
    '/admin/',
    '/conta/',
    '/api/',
    '/carrinho',
    '/checkout',
    '/pedido/',
    '/busca',
  ]) {
    lines.push(`Disallow: ${path}`)
  }

  if (siteUrl) {
    lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`)
  }

  return `${lines.join('\n')}\n`
}

export function sitemapXmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${SITEMAP_REVALIDATE_SECONDS}, stale-while-revalidate=${SITEMAP_REVALIDATE_SECONDS}`,
    },
  })
}

export function robotsTxtResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  })
}

export function sitemapNotConfiguredResponse(): Response {
  return sitemapXmlResponse(
    '<?xml version="1.0" encoding="UTF-8"?><error>NEXT_PUBLIC_SITE_URL não configurada</error>',
    503
  )
}
