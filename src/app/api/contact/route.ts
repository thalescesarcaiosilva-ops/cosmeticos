import { createAdminClient } from '@/lib/supabase/admin'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { contactFormSchema } from '@/schemas/contact-schema'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = contactFormSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  if (parsed.data.website?.trim()) {
    return jsonSuccess({ ok: true }, 'Mensagem enviada com sucesso')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('contact_messages').insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    subject: parsed.data.subject,
    message: parsed.data.message,
    status: 'new',
  })

  if (error) {
    if (error.code === '42P01') {
      return jsonError(
        'Formulário indisponível. Aplique a migration contact_messages no Supabase.',
        503
      )
    }
    return jsonError('Não foi possível enviar a mensagem. Tente novamente.', 500)
  }

  return jsonSuccess({ ok: true }, 'Mensagem enviada com sucesso! Responderemos em breve.')
}
