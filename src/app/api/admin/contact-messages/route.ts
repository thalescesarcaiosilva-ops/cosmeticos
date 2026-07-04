import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { contactMessageStatusUpdateSchema } from '@/schemas/contact-schema'

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

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  const admin = createAdminClient()
  let query = admin
    .from('contact_messages')
    .select('id, name, email, phone, subject, message, status, created_at')
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === '42P01') {
      return jsonError('Aplique a migration contact_messages no Supabase.', 503)
    }
    return jsonError('Não foi possível carregar as mensagens', 500)
  }

  return jsonSuccess(data ?? [])
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

  const parsed = contactMessageStatusUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Dados inválidos', 400)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contact_messages')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .select('id, status')
    .single()

  if (error || !data) {
    return jsonError('Não foi possível atualizar a mensagem', 400)
  }

  return jsonSuccess(data, 'Status atualizado')
}
