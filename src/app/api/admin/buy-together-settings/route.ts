import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  getAdminBuyTogetherSettings,
  updateBuyTogetherSettings,
} from '@/lib/products/buy-together-settings'
import { updateBuyTogetherSettingsSchema } from '@/schemas/buy-together-settings-schema'

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

  // Garante cliente admin inicializado (mesmo padrão das outras rotas)
  createAdminClient()
  const { settings, columnAvailable } = await getAdminBuyTogetherSettings()

  return jsonSuccess({
    ...settings,
    column_available: columnAvailable,
  })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = updateBuyTogetherSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const { settings, columnAvailable } = await updateBuyTogetherSettings(parsed.data)

  if (!settings || !columnAvailable) {
    return jsonError(
      'Não foi possível salvar. Aplique a migration 202607200002_buy_together_settings.sql no Supabase.',
      400,
      'MIGRATION_REQUIRED'
    )
  }

  return jsonSuccess(
    { ...settings, column_available: true },
    'Configurações do Compre junto salvas'
  )
}
