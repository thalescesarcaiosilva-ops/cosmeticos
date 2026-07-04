'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CardAuth } from '@/components/auth/CardAuth'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { fetchApi } from '@/lib/api/fetch-api'
import { resetPasswordSchema } from '@/schemas/auth-schema'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { error: apiError } = await fetchApi<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: parsed.data.password }),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    router.push('/conta/login?reset=ok')
    router.refresh()
  }

  return (
    <CardAuth title="Nova senha">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        <PasswordInput
          label="Nova senha"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} />
        <PasswordInput
          label="Confirmar senha"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" loading={loading} className="w-full">
          Salvar nova senha
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
