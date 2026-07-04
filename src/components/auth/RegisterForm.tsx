'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CardAuth } from '@/components/auth/CardAuth'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { registerSchema } from '@/schemas/auth-schema'
import { fetchApi } from '@/lib/api/fetch-api'

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const parsed = registerSchema.safeParse({ name, email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { data, error: apiError } = await fetchApi<{ ok: boolean; needsEmailConfirm?: boolean }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      }
    )
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    if (data?.needsEmailConfirm) {
      setSuccess('Conta criada! Verifique seu e-mail para confirmar e depois faça login.')
      return
    }

    setSuccess('Conta criada! Redirecionando…')
    setTimeout(() => {
      router.push('/conta/login')
      router.refresh()
    }, 1500)
  }

  return (
    <CardAuth title="Criar conta">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        <Input
          label="Nome completo"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Senha"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} />
        <Button type="submit" loading={loading} className="w-full">
          Cadastrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        Já tem conta?{' '}
        <Link href="/conta/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </CardAuth>
  )
}
