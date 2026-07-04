'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CardAuth } from '@/components/auth/CardAuth'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { forgotPasswordSchema } from '@/schemas/auth-schema'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { error: apiError } = await fetchApi<{ ok: boolean }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    setSuccess(
      'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha em alguns minutos.'
    )
  }

  return (
    <CardAuth title="Esqueci minha senha">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        <p className="text-sm text-text-secondary">
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>
        <Input
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" loading={loading} className="w-full">
          Enviar link
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
