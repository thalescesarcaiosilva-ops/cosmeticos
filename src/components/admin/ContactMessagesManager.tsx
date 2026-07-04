'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fetchApi } from '@/lib/api/fetch-api'
import { contactMessageStatusSchema } from '@/schemas/contact-schema'

type ContactMessage = {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
  status: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nova',
  read: 'Lida',
  archived: 'Arquivada',
}

export function ContactMessagesManager() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    const { data, error: apiError } = await fetchApi<ContactMessage[]>(
      `/api/admin/contact-messages${query}`
    )
    if (apiError) setError(apiError)
    else {
      setError(null)
      setMessages(data ?? [])
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const unread = messages.filter((m) => m.status === 'new').length
    return { total: messages.length, unread }
  }, [messages])

  async function updateStatus(id: string, status: string) {
    setLoadingId(id)
    const { error: apiError } = await fetchApi('/api/admin/contact-messages', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    })
    setLoadingId(null)

    if (apiError) {
      setError(apiError)
      return
    }

    load()
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Nesta lista">
          <p className="text-2xl font-bold text-[#3d1654]">{counts.total}</p>
        </Card>
        <Card title="Não lidas">
          <p className="text-2xl font-bold text-badge-discount">{counts.unread}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-text-secondary" htmlFor="message-status-filter">
          Filtrar:
        </label>
        <select
          id="message-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="all">Todas</option>
          {contactMessageStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={load}>
          Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {messages.map((message) => {
          const expanded = expandedId === message.id
          return (
            <Card key={message.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-text-primary">{message.subject}</p>
                    {message.status === 'new' && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                        Nova
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {message.name} · {message.email}
                    {message.phone ? ` · ${message.phone}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(message.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select
                    value={message.status}
                    disabled={loadingId === message.id}
                    onChange={(e) => updateStatus(message.id, e.target.value)}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    aria-label="Status da mensagem"
                  >
                    {contactMessageStatusSchema.options.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setExpandedId(expanded ? null : message.id)
                      if (!expanded && message.status === 'new') {
                        updateStatus(message.id, 'read')
                      }
                    }}
                  >
                    {expanded ? 'Ocultar' : 'Ler mensagem'}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                    {message.message}
                  </p>
                  <a
                    href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`}
                    className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
                  >
                    Responder por e-mail →
                  </a>
                </div>
              )}
            </Card>
          )
        })}

        {messages.length === 0 && (
          <Card>
            <p className="text-text-secondary">Nenhuma mensagem recebida ainda.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
