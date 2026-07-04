import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { id } = paramsSchema.parse(await context.params)

  const supabase = await createClient()
  const { data: asset, error: fetchError } = await supabase
    .from('media_assets')
    .select('id, storage_path, bucket')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !asset) {
    return jsonError('Mídia não encontrada', 404)
  }

  const admin = createAdminClient()
  await admin.storage.from(asset.bucket).remove([asset.storage_path])
  const { error } = await admin.from('media_assets').delete().eq('id', id)

  if (error) {
    return jsonError('Não foi possível remover a mídia', 400)
  }

  return jsonSuccess({ ok: true }, 'Mídia removida')
}
