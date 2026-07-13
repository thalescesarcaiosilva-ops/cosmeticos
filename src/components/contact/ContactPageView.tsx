'use client'

import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { ContactPageData } from '@/lib/contact/get-contact-page-data'
import { fetchApi } from '@/lib/api/fetch-api'
import { contactFormSchema } from '@/schemas/contact-schema'
import { SocialIcon } from '@/components/layout/SocialIcon'

type ContactFormProps = {
  data: ContactPageData
}

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'subject' | 'message', string>>

function ContactChannel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-text-secondary">{children}</div>
      </div>
    </div>
  )
}

export function ContactPageView({ data }: ContactFormProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    const parsed = contactFormSchema.safeParse(form)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && key in next === false) {
          next[key as keyof FieldErrors] = issue.message
        }
      }
      setErrors(next)
      return
    }

    setErrors({})
    setLoading(true)

    const { error, message } = await fetchApi('/api/contact', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    })

    setLoading(false)

    if (error) {
      setFeedback({ type: 'error', message: error })
      return
    }

    setFeedback({
      type: 'success',
      message: message ?? 'Mensagem enviada com sucesso! Responderemos em breve.',
    })
    setForm({ name: '', email: '', phone: '', subject: '', message: '', website: '' })
  }

  const phoneLine = data.phoneDisplay
  const showPhoneBlock = Boolean(phoneLine)

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Suporte</p>
        <h1 className="mt-2 text-3xl font-bold text-logo md:text-4xl">{data.pageTitle}</h1>
        {data.intro && (
          <p className="mt-4 text-base leading-relaxed text-text-secondary">{data.intro}</p>
        )}
      </header>

      {data.supportTopics.length > 0 && (
        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.supportTopics.map((topic) => (
            <article
              key={topic.title}
              className="rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                <MessageCircle className="size-4" aria-hidden />
              </div>
              <h2 className="text-base font-semibold text-text-primary">{topic.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{topic.description}</p>
            </article>
          ))}
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-10">
        <section className="rounded-lg border border-border bg-surface p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold text-logo">Canais de Atendimento</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Entre em contato direto pelos canais oficiais ou visite nossa loja.
          </p>

          <div className="mt-8 space-y-6">
            {data.address && (
              <ContactChannel icon={<MapPin className="size-5" aria-hidden />} title="Endereço">
                <p>{data.address}</p>
              </ContactChannel>
            )}

            {showPhoneBlock && (
              <ContactChannel icon={<Phone className="size-5" aria-hidden />} title="Telefone">
                {phoneLine && data.phoneHref ? (
                  <a href={data.phoneHref} className="hover:text-brand">
                    {phoneLine}
                  </a>
                ) : (
                  <span>{phoneLine}</span>
                )}
              </ContactChannel>
            )}

            {data.email && (
              <ContactChannel icon={<Mail className="size-5" aria-hidden />} title="E-mail">
                <a href={`mailto:${data.email}`} className="hover:text-brand">
                  {data.email}
                </a>
              </ContactChannel>
            )}

            {data.businessHours && (
              <ContactChannel
                icon={<Clock className="size-5" aria-hidden />}
                title="Horário de Funcionamento"
              >
                <p>{data.businessHours}</p>
              </ContactChannel>
            )}
          </div>

          {data.socialLinks.length > 0 && (
            <div className="mt-10 border-t border-border pt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Siga-nos nas redes
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {data.socialLinks.map((social) => (
                  <a
                    key={social.type}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-10 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-brand hover:text-brand"
                    aria-label={social.label}
                  >
                    <SocialIcon type={social.type} className="size-5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold text-logo">Envie uma Mensagem</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Descreva sua dúvida ou solicitação. Nossa equipe responde em horário comercial.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {feedback && <Alert type={feedback.type}>{feedback.message}</Alert>}

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Nome completo *"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João Silva"
                error={errors.name}
                autoComplete="name"
                required
                maxLength={200}
              />
              <Input
                label="Seu e-mail *"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Ex: joao@email.com"
                error={errors.email}
                autoComplete="email"
                required
                maxLength={200}
              />
            </div>

            <Input
              label="Telefone / Celular"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Ex: (27) 98865-3033"
              error={errors.phone}
              autoComplete="tel"
              maxLength={30}
            />

            <Input
              label="Assunto *"
              name="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Ex: Dúvida sobre entrega"
              error={errors.subject}
              required
              maxLength={200}
            />

            <Textarea
              label="Mensagem *"
              name="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Escreva sua dúvida, sugestão ou feedback aqui..."
              rows={6}
              error={errors.message}
              required
              maxLength={5000}
            />

            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full gap-2 rounded-md sm:w-auto"
            >
              <Send className="size-4" aria-hidden />
              Enviar Mensagem
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}
