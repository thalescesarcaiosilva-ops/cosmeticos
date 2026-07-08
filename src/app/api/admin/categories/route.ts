import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { toSiteMediaUrl } from '@/lib/media/public-url'
import { createCategorySchema } from '@/schemas/category-schema'

const CATEGORY_COLUMNS =
  'id, name, slug, image_url, banner_image_url, page_title, description, sort_order, active, created_at'

const CATEGORY_COLUMNS_LEGACY =
  'id, name, slug, image_url, banner_image_url, seal_image_url, page_title, description, sort_order, active, created_at'

function mapAdminCategory(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    image_url: toSiteMediaUrl(
      (row.image_url as string | null) ?? (row.seal_image_url as string | null) ?? null
    ),
    banner_image_url: toSiteMediaUrl(row.banner_image_url as string | null),
    page_title: row.page_title,
    description: row.description,
    sort_order: row.sort_order,
    active: row.active,
    created_at: row.created_at,
  }
}

async function fetchCategories(supabase: Awaited<ReturnType<typeof createClient>>) {
  const full = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .order('sort_order', { ascending: true })

  if (!full.error && full.data) {
    return {
      data: full.data.map((row) => mapAdminCategory(row as Record<string, unknown>)),
    }
  }

  const legacy = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS_LEGACY)
    .order('sort_order', { ascending: true })

  if (legacy.error) return { error: legacy.error }
  return {
    data: (legacy.data ?? []).map((row) => mapAdminCategory(row as Record<string, unknown>)),
  }
}

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return jsonError('Acesso negado', 403, 'FORBIDDEN')
    }
    return jsonError('Erro interno', 500)
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const supabase = await createClient()
  const result = await fetchCategories(supabase)

  if ('error' in result && result.error) {
    return jsonError('Não foi possível carregar as categorias', 500)
  }

  return jsonSuccess(result.data ?? [])
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .insert(parsed.data)
    .select(CATEGORY_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar a categoria', 400)
  }

  revalidateTag('collections', 'max')

  return jsonSuccess(data, 'Categoria criada', 201)
}
