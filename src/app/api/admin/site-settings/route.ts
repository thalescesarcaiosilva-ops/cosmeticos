import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  fetchAdminSiteSettings,
  updateAdminSiteSettings,
} from '@/lib/site-settings/admin-queries'
import { updateSiteSettingsSchema } from '@/schemas/site-settings-schema'

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
  const { data, paymentColumnsAvailable } = await fetchAdminSiteSettings(supabase)

  if (!data) {
    return jsonError('Não foi possível carregar as configurações', 500)
  }

  return jsonSuccess({
    ...data,
    payment_columns_available: paymentColumnsAvailable,
    seo_columns_available: data._seoColumnsAvailable !== false,
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

  const parsed = updateSiteSettingsSchema.safeParse(body)
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError('Dados inválidos', 400)
  }

  const supabase = createAdminClient()
  const { data, paymentSaveSkipped, paymentConfigSkipped, paymentUpdateError, paymentColumnsAvailable } =
    await updateAdminSiteSettings(supabase, parsed.data as Record<string, unknown>)

  if (paymentUpdateError) {
    return jsonError(paymentUpdateError, 400)
  }

  if (!data) {
    return jsonError('Não foi possível atualizar as configurações', 400)
  }

  revalidateTag('site-layout', 'max')
  revalidatePath('/', 'layout')
  revalidatePath('/paginas/fale-conosco')

  const message = paymentConfigSkipped
    ? 'Configurações salvas parcialmente. Execute supabase/migrations/202507010003_payment_methods_config.sql no Supabase para salvar formas de pagamento com ícone.'
    : paymentSaveSkipped
      ? 'Configurações da loja salvas. Parcelamento não foi salvo — execute PARTE_10_payment_settings.sql no Supabase.'
      : 'Configurações atualizadas'

  return jsonSuccess(
    {
      ...data,
      payment_columns_available: paymentColumnsAvailable,
      seo_columns_available: data._seoColumnsAvailable !== false,
      payment_config_skipped: paymentConfigSkipped,
    },
    message
  )
}
