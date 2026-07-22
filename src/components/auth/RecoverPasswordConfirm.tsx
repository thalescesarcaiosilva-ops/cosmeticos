'use client'

import Link from 'next/link'
import { CardAuth } from '@/components/auth/CardAuth'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

type Props = {
  tokenHash: string
  type: string
  next: string
}

export function RecoverPasswordConfirm({ tokenHash, type, next }: Props) {
  if (!tokenHash) {
    return (
      <CardAuth title="Link inválido">
        <Alert type="error">
          Este link de redefinição está incompleto ou expirou. Solicite um novo e-mail.
        </Alert>
        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/conta/esqueci-senha" className="font-medium text-brand hover:underline">
            Pedir novo link
          </Link>
        </p>
      </CardAuth>
    )
  }

  return (
    <CardAuth title="Redefinir senha">
      <p className="mb-6 text-sm text-text-secondary">
        Para sua segurança, confirme abaixo para continuar. Isso evita que o link seja usado
        automaticamente pelo antivírus do e-mail.
      </p>
      <form action="/auth/confirm" method="post" className="space-y-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" className="w-full">
          Continuar para criar nova senha
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        <Link href="/conta/login" className="font-medium text-brand hover:underline">
          Voltar ao login
        </Link>
      </p>
    </CardAuth>
  )
}
