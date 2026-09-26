'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'

type SupportLoginFormProps = {
  storeName: string
  adminWarning: boolean
}

export function SupportLoginForm({ storeName, adminWarning }: SupportLoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const { error: apiError } = await fetchApi('/api/suporte/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (apiError) {
      setError(apiError)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-10 text-neutral-900">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {storeName}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950">Fila de suporte</h1>
        <p className="mt-2 text-sm text-neutral-500">Entre com o acesso de suporte.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {adminWarning && (
            <Alert type="warning">
              Este acesso não abre o painel do administrador. Use o login de suporte para ver a fila.
            </Alert>
          )}
          {error && <Alert type="error">{error}</Alert>}
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full !rounded-md" loading={loading}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
