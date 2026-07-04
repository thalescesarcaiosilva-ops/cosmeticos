import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  fetchAdminFooterSettings,
  updateAdminFooterSettings,
} from '@/lib/footer/admin-queries'
import { updateFooterSettingsSchema } from '@/schemas/footer-settings-schema'

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
  const { data, footerColumnsAvailable } = await fetchAdminFooterSettings(supabase)

  if (!data) {
    return jsonError('Não foi possível carregar as configurações do rodapé', 500)
  }

  return jsonSuccess({
    ...data,
    footer_columns_available: footerColumnsAvailable,
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

  const parsed = updateFooterSettingsSchema.safeParse(body)
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, footerColumnsAvailable } = await updateAdminFooterSettings(
    supabase,
    parsed.data as Record<string, unknown>
  )

  if (!data) {
    const message = footerColumnsAvailable
      ? 'Não foi possível atualizar as configurações do rodapé'
      : 'Execute supabase/sql/PARTE_12_footer_system.sql no Supabase para habilitar o rodapé.'
    return jsonError(message, 400)
  }

  revalidateTag('site-layout', 'max')

  return jsonSuccess(
    { ...data, footer_columns_available: footerColumnsAvailable },
    'Configurações do rodapé atualizadas'
  )
}
