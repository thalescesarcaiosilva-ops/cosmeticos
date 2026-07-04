import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { createBrandSchema } from '@/schemas/product-schema'

const BRAND_COLUMNS = 'id, name, slug, active, created_at'

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
  const { data, error } = await supabase
    .from('brands')
    .select(BRAND_COLUMNS)
    .order('name')

  if (error) {
    return jsonError('Não foi possível carregar as marcas', 500)
  }

  return jsonSuccess(data ?? [])
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

  const parsed = createBrandSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('brands')
    .insert(parsed.data)
    .select(BRAND_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar a marca', 400)
  }

  return jsonSuccess(data, 'Marca criada', 201)
}
