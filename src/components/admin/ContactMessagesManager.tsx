'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
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
  replied_at?: string | null
  last_reply_preview?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nova',
  read: 'Lida',
  archived: 'Arquivada',
}

export function ContactMessagesManager() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null)

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
    const replied = messages.filter((m) => Boolean(m.replied_at)).length
    return { total: messages.length, unread, replied }
  }, [messages])

  async function updateStatus(id: string, status: string) {
    setLoadingId(id)
    setSuccess(null)
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

  async function sendReply(message: ContactMessage) {
    const body = (replyDrafts[message.id] ?? '').trim()
    if (body.length < 5) {
      setError('Escreva uma resposta com pelo menos 5 caracteres')
      return
    }

    setSendingReplyId(message.id)
    setError(null)
    setSuccess(null)
    const { error: apiError, message: okMessage } = await fetchApi('/api/admin/contact-messages', {
      method: 'PATCH',
      body: JSON.stringify({ id: message.id, body }),
    })
    setSendingReplyId(null)

    if (apiError) {
      setError(apiError)
      return
    }

    setSuccess(okMessage ?? 'Resposta enviada')
    setReplyDrafts((prev) => ({ ...prev, [message.id]: '' }))
    load()
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Total">
          <p className="text-2xl font-bold text-neutral-900">{counts.total}</p>
        </Card>
        <Card title="Não lidas">
          <p className="text-2xl font-bold text-neutral-900">{counts.unread}</p>
        </Card>
        <Card title="Respondidas">
          <p className="text-2xl font-bold text-neutral-900">{counts.replied}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-neutral-600" htmlFor="message-status-filter">
          Filtrar:
        </label>
        <select
          id="message-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
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
                    <p className="font-semibold text-neutral-900">{message.subject}</p>
                    {message.status === 'new' && (
                      <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                        Nova
                      </span>
                    )}
                    {message.replied_at && (
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                        Respondida
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {message.name} · {message.email}
                    {message.phone ? ` · ${message.phone}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(message.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select
                    value={message.status}
                    disabled={loadingId === message.id}
                    onChange={(e) => updateStatus(message.id, e.target.value)}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
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
                    variant="secondary"
                    onClick={() => {
                      setExpandedId(expanded ? null : message.id)
                      if (!expanded && message.status === 'new') {
                        updateStatus(message.id, 'read')
                      }
                    }}
                  >
                    {expanded ? 'Ocultar' : 'Abrir e responder'}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Mensagem do cliente
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                      {message.message}
                    </p>
                  </div>

                  {message.last_reply_preview && (
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Última resposta enviada
                        {message.replied_at
                          ? ` · ${new Date(message.replied_at).toLocaleString('pt-BR')}`
                          : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
                        {message.last_reply_preview}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 rounded-md border border-neutral-300 bg-white p-4">
                    <p className="text-sm font-semibold text-neutral-900">
                      Responder por e-mail (Resend)
                    </p>
                    <Textarea
                      label="Sua resposta"
                      rows={5}
                      value={replyDrafts[message.id] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [message.id]: e.target.value }))
                      }
                      placeholder={`Olá ${message.name}, obrigado pelo contato...`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        loading={sendingReplyId === message.id}
                        onClick={() => sendReply(message)}
                      >
                        Enviar resposta
                      </Button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      O e-mail é enviado via Resend para o cliente. Cada resposta consome 1 envio
                      da cota.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {messages.length === 0 && (
          <Card>
            <p className="text-neutral-600">Nenhuma mensagem recebida ainda.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
