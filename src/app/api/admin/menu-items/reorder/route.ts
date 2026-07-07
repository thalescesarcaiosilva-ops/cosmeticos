import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'

const menuItemUpdateSchema = z.object({
  id: z.string().uuid(),
  sort_order: z.number().int().min(0),
  parent_id: z.string().uuid().nullable(),
})

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).optional(),
  items: z.array(menuItemUpdateSchema).min(1).optional(),
})

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

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success || (!parsed.data.orderedIds && !parsed.data.items)) {
    return jsonError('Lista de itens inválida', 400)
  }

  const supabase = await createClient()

  const updates =
    parsed.data.items ??
    parsed.data.orderedIds!.map((id, index) => ({
      id,
      sort_order: index,
      parent_id: null,
    }))

  const results = await Promise.all(
    updates.map((item) =>
      supabase
        .from('menu_items')
        .update({ sort_order: item.sort_order, parent_id: item.parent_id })
        .eq('id', item.id)
    )
  )

  const failed = results.find((result) => result.error)
  if (failed?.error) {
    return jsonError('Não foi possível reordenar o menu', 400)
  }

  const parentIds = [...new Set(updates.map((item) => item.parent_id).filter(Boolean))] as string[]
  if (parentIds.length > 0) {
    await supabase.from('menu_items').update({ has_dropdown: true }).in('id', parentIds)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess({ ok: true }, 'Menu atualizado')
}
