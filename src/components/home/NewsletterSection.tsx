'use client'

import { useState } from 'react'
import { Check, Mail, Sparkles } from 'lucide-react'
import { storeContent } from '@/lib/store-content/content'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function NewsletterSection() {
  const config = storeContent.home.newsletter
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setStatus('error')
      return
    }
    setStatus('success')
    setEmail('')
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-plum px-6 py-12 text-cream md:px-12 md:py-16">
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-rose/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-gold/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-4xl items-center gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-cream/70">
            <Sparkles className="size-3.5" aria-hidden />
            {config.eyebrow}
          </p>
          <h2 className="font-display text-2xl leading-tight md:text-[2rem]">{config.title}</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/80">
            {config.description}
          </p>

          {config.benefits.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {config.benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-cream/85">
                  <span className="flex size-4 items-center justify-center rounded-full bg-rose/30">
                    <Check className="size-2.5 text-cream" aria-hidden />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {status === 'success' ? (
            <div className="flex items-center gap-3 rounded-2xl bg-cream/10 p-6 ring-1 ring-cream/20">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage text-white">
                <Check className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium text-cream">Inscrição confirmada!</p>
                <p className="text-sm text-cream/75">
                  Você começará a receber nossas novidades em breve.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-plum/40"
                  aria-hidden
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (status === 'error') setStatus('idle')
                  }}
                  placeholder={config.placeholder}
                  aria-label="Seu e-mail"
                  aria-invalid={status === 'error'}
                  className="w-full rounded-full border-0 bg-cream py-3.5 pl-12 pr-4 text-sm text-ink placeholder:text-plum/40 focus:outline-none focus:ring-2 focus:ring-rose"
                />
              </div>
              {status === 'error' && (
                <p className="px-2 text-xs text-rose-200">Informe um e-mail válido.</p>
              )}
              <button
                type="submit"
                className="w-full rounded-full bg-rose px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-rosed"
              >
                {config.buttonLabel}
              </button>
              <p className="text-center text-xs text-cream/60">{config.disclaimer}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
