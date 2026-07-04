'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { profileUpdateSchema } from '@/schemas/profile-schema'

type Profile = {
  id: string
  name: string
  email: string
  cpf: string | null
  phone: string | null
}

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchApi<Profile>('/api/account/profile').then(({ data }) => {
      if (data) {
        setProfile(data)
        setName(data.name ?? '')
        setCpf(data.cpf ?? '')
        setPhone(data.phone ?? '')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const payload = {
      name: name.trim() || undefined,
      cpf: cpf.trim() || null,
      phone: phone.trim() || null,
    }

    const parsed = profileUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const { data, error: apiError } = await fetchApi<Profile>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    if (data) setProfile(data)
    setSuccess('Dados atualizados com sucesso')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meus dados</h1>
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}
      <Card>
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <Input label="E-mail" value={profile?.email ?? ''} disabled />
          <Input
            label="Nome"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="CPF"
            name="cpf"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
          />
          <Input
            label="Telefone"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
          <Button type="submit" loading={loading}>
            Salvar alterações
          </Button>
        </form>
      </Card>
    </div>
  )
}
