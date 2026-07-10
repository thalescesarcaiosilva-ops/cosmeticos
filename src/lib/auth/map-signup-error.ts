import type { AuthError } from '@supabase/supabase-js'

export function isEmailConfirmFailure(error: AuthError): boolean {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toLowerCase()

  if (
    msg.includes('confirmation email') ||
    msg.includes('email rate limit') ||
    code.includes('over_email_send_rate_limit') ||
    code.includes('email_address_invalid')
  ) {
    return true
  }

  // Supabase-js oculta o corpo do erro 500 de e-mail como message: '{}'
  if (error.status === 500 && (msg === '{}' || error.name === 'AuthRetryableFetchError')) {
    return true
  }

  return false
}

/** Quando o Supabase falha ao enviar/validar e-mail de confirmação, cria a conta via Admin API. */
export function shouldFallbackToAdminSignup(error: AuthError): boolean {
  return isEmailConfirmFailure(error)
}

export function isDuplicateSignup(user: { identities?: { id: string }[] } | null): boolean {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0)
}

export function mapSignUpError(error: AuthError): string {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toLowerCase()

  if (
    msg.includes('rate limit') ||
    code.includes('rate_limit') ||
    msg.includes('too many requests')
  ) {
    return 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.'
  }

  if (isEmailConfirmFailure(error)) {
    return 'Não foi possível enviar o e-mail de confirmação. No Supabase, desative "Confirm email" (Authentication → Providers → Email) ou configure SMTP.'
  }

  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    code.includes('user_already_exists')
  ) {
    return 'Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.'
  }

  if (msg.includes('password') && msg.includes('weak')) {
    return 'Senha fraca. Use no mínimo 8 caracteres, com letra maiúscula e número.'
  }

  if (
    code.includes('email_address_invalid') ||
    (msg.includes('email address') && msg.includes('invalid'))
  ) {
    return 'Não foi possível validar o e-mail no servidor de confirmação. Tente outro e-mail ou desative a confirmação por e-mail no Supabase.'
  }

  if (msg.includes('invalid email')) {
    return 'E-mail inválido.'
  }

  if (msg.includes('signups not allowed') || msg.includes('signup is disabled')) {
    return 'Cadastro temporariamente indisponível. Tente mais tarde.'
  }

  if (msg.includes('database error')) {
    return 'Erro no banco ao criar conta. Execute PARTE_6_fix_signup.sql no Supabase.'
  }

  return 'Não foi possível criar a conta. Tente novamente.'
}

export function logSignUpError(error: AuthError) {
  console.error('[auth/register]', {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.status,
  })
}
