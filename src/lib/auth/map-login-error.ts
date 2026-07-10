import type { AuthError } from '@supabase/supabase-js'

export function mapLoginError(error: AuthError): string {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toLowerCase()

  if (
    code.includes('email_not_confirmed') ||
    msg.includes('email not confirmed') ||
    msg.includes('not confirmed')
  ) {
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada ou solicite um novo link.'
  }

  if (
    code.includes('invalid_credentials') ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return 'E-mail ou senha incorretos.'
  }

  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }

  if (msg.includes('user banned') || msg.includes('disabled')) {
    return 'Esta conta está desativada. Entre em contato com o suporte.'
  }

  return 'E-mail ou senha incorretos.'
}
