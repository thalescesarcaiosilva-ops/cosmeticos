'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  clearGuestOrderToken,
  readGuestOrderToken,
} from '@/lib/checkout/guest-access'
import { createAccountFromOrderSchema } from '@/schemas/auth-schema'

type Props = {
  orderId: string
  customerEmail: string | null
}

export function OrderClaimAccountForm({ orderId, customerEmail }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const guestToken = readGuestOrderToken(orderId)
    if (!guestToken) {
      setError('Sessão do pedido expirada. Use o link do e-mail ou faça login com o mesmo e-mail da compra.')
      return
    }

    const parsed = createAccountFromOrderSchema.safeParse({
      password,
      confirmPassword,
      guestToken,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { data, error: apiError } = await fetchApi<{
      ok: boolean
      signedIn?: boolean
      redirectTo?: string
    }>(`/api/checkout/orders/${orderId}/create-account`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    clearGuestOrderToken(orderId)
    setSuccess('Conta criada! Redirecionando para seus pedidos…')
    router.push(data?.redirectTo ?? '/conta/pedidos')
    router.refresh()
  }

  const loginHref = customerEmail
    ? `/conta/login?email=${encodeURIComponent(customerEmail)}&redirect=${encodeURIComponent('/conta/pedidos')}`
    : '/conta/login?redirect=/conta/pedidos'

  return (
    <div className="mt-8 rounded-xl border border-brand/20 bg-brand/5 p-5">
      <h2 className="text-base font-semibold text-text-primary">
        Acompanhe este pedido na sua conta
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Defina uma senha para criar sua conta com o e-mail da compra
        {customerEmail ? (
          <>
            {' '}
            (<span className="font-medium text-text-primary">{customerEmail}</span>)
          </>
        ) : null}
        . O pagamento já foi registrado — isso não interfere na compra.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        <PasswordInput
          label="Criar senha"
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
        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          Criar conta e ver pedidos
        </Button>
      </form>

      <p className="mt-4 text-sm text-text-secondary">
        Já tem conta?{' '}
        <Link href={loginHref} className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
