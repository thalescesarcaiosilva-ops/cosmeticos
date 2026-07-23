import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { sendContactReplyEmail } from '@/lib/email/contact-reply'
import {
  contactMessageReplySchema,
  contactMessageStatusUpdateSchema,
} from '@/schemas/contact-schema'

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
    .select(
      'id, name, email, phone, subject, message, status, created_at, replied_at, last_reply_preview'
    )
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === '42P01') {
      return jsonError('Aplique a migration contact_messages no Supabase.', 503)
    }
    // Fallback se colunas de reply ainda não existirem
    const legacy = await admin
      .from('contact_messages')
      .select('id, name, email, phone, subject, message, status, created_at')
      .order('created_at', { ascending: false })
    if (legacy.error) {
      return jsonError('Não foi possível carregar as mensagens', 500)
    }
    return jsonSuccess(legacy.data ?? [])
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

  const replyParsed = contactMessageReplySchema.safeParse(body)
  if (replyParsed.success) {
    const admin = createAdminClient()
    const { data: message, error: loadError } = await admin
      .from('contact_messages')
      .select('id, name, email, subject, message, status')
      .eq('id', replyParsed.data.id)
      .maybeSingle()

    if (loadError || !message) {
      return jsonError('Mensagem não encontrada', 404)
    }

    const sent = await sendContactReplyEmail({
      toEmail: message.email,
      toName: message.name,
      subject: message.subject,
      originalMessage: message.message,
      replyBody: replyParsed.data.body,
    })

    if (!sent.ok) {
      return jsonError(
        sent.reason === 'missing_api_key'
          ? 'RESEND_API_KEY não configurada'
          : `Falha ao enviar e-mail: ${sent.reason ?? 'erro desconhecido'}`,
        503
      )
    }

    await admin.from('contact_message_replies').insert({
      message_id: message.id,
      body: replyParsed.data.body,
      sent_by: auth.id,
    })

    const preview = replyParsed.data.body.slice(0, 240)
    await admin
      .from('contact_messages')
      .update({
        status: message.status === 'new' ? 'read' : message.status,
        replied_at: new Date().toISOString(),
        last_reply_preview: preview,
      })
      .eq('id', message.id)

    return jsonSuccess({ id: message.id }, 'Resposta enviada por e-mail')
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
