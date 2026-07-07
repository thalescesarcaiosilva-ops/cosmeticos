import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { upsertProductVariationsSchema } from '@/schemas/product-variation-schema'

const paramsSchema = z.object({ id: z.string().uuid() })

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id: productId } = paramsSchema.parse(await context.params)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('product_variations')
    .select('id, product_id, name, sku, price, stock, media_id, sort_order, active, media:media_assets(id, public_url, alt_text)')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (error) {
    if (error.code === '42P01') {
      return jsonError('Aplique a migration de variações no Supabase.', 503)
    }
    return jsonError('Não foi possível carregar variações', 500)
  }

  return jsonSuccess(data ?? [])
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id: productId } = paramsSchema.parse(await context.params)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = upsertProductVariationsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const rows = parsed.data.variations.map((variation, index) => ({
    product_id: productId,
    name: variation.name.trim(),
    sku: variation.sku?.trim() || null,
    price: variation.price,
    stock: variation.stock,
    media_id: variation.media_id ?? null,
    active: variation.active ?? true,
    sort_order: variation.sort_order ?? index,
  }))

  const admin = createAdminClient()
  const { error: deleteError } = await admin
    .from('product_variations')
    .delete()
    .eq('product_id', productId)

  if (deleteError) {
    if (deleteError.code === '42P01') {
      return jsonError('Aplique a migration de variações no Supabase.', 503)
    }
    return jsonError('Não foi possível atualizar variações', 400)
  }

  if (rows.length === 0) return jsonSuccess([], 'Variações atualizadas')

  const { data, error } = await admin
    .from('product_variations')
    .insert(rows)
    .select('id, product_id, name, sku, price, stock, media_id, sort_order, active')
    .order('sort_order', { ascending: true })

  if (error) {
    return jsonError('Não foi possível salvar variações', 400)
  }

  return jsonSuccess(data ?? [], 'Variações atualizadas')
}
