'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { fetchApi } from '@/lib/api/fetch-api'
import type { ApprovedProductReview } from '@/lib/products/reviews'

type ProductReviewsSectionProps = {
  productSlug: string
  reviews: ApprovedProductReview[]
}

const emptyForm = {
  author_name: '',
  author_email: '',
  rating: '5',
  title: '',
  comment: '',
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={14}
          className={
            index < rating
              ? 'fill-[#c4a035] text-[#c4a035]'
              : 'fill-transparent text-border'
          }
        />
      ))}
    </div>
  )
}

export function ProductReviewsSection({ productSlug, reviews }: ProductReviewsSectionProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    setSending(true)
    const { error: apiError, message } = await fetchApi(`/api/products/${productSlug}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        author_name: form.author_name.trim(),
        author_email: form.author_email.trim() || null,
        rating: Number.parseInt(form.rating, 10),
        title: form.title.trim() || null,
        comment: form.comment.trim(),
      }),
    })
    setSending(false)

    if (apiError) {
      setError(apiError)
      return
    }

    setSuccess(message ?? 'Avaliação enviada com sucesso.')
    setForm(emptyForm)
  }

  return (
    <section className="mt-10 border-t border-border pt-8 md:mt-12 md:pt-10">
      <header className="mb-6 max-w-2xl">
        <h2 className="text-xl font-bold text-text-primary md:text-2xl">Avaliações</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          Opiniões de clientes. Novos comentários passam por moderação antes de aparecer.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10">
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-cream/50 px-5 py-8 text-sm text-text-secondary">
              Este produto ainda não possui avaliações aprovadas. Seja a primeira pessoa a
              avaliar.
            </div>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-xl border border-border bg-surface px-4 py-4 md:px-5"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[13px] font-semibold text-text-secondary"
                      aria-hidden
                    >
                      {review.author_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">
                        {review.author_name}
                      </p>
                      <ReviewStars rating={review.rating} />
                    </div>
                  </div>
                  <time
                    dateTime={review.created_at}
                    className="text-xs text-text-muted tabular-nums"
                  >
                    {new Date(review.created_at).toLocaleDateString('pt-BR')}
                  </time>
                </header>
                {review.title && (
                  <p className="mt-3 text-sm font-semibold text-text-primary">{review.title}</p>
                )}
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {review.comment}
                </p>
              </article>
            ))
          )}
        </div>

        <form
          className="space-y-3 rounded-xl border border-border bg-surface p-4 md:p-5"
          onSubmit={handleSubmit}
        >
          <h3 className="text-base font-semibold text-text-primary">Deixe sua avaliação</h3>
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Nome"
              value={form.author_name}
              onChange={(e) => setForm((prev) => ({ ...prev, author_name: e.target.value }))}
              required
            />
            <Input
              label="E-mail (opcional)"
              type="email"
              value={form.author_email}
              onChange={(e) => setForm((prev) => ({ ...prev, author_email: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Nota</label>
              <select
                value={form.rating}
                onChange={(e) => setForm((prev) => ({ ...prev, rating: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={String(value)}>
                    {value} estrela{value > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Título (opcional)"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <Textarea
            label="Comentário"
            value={form.comment}
            onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            rows={4}
            required
          />

          <Button type="submit" loading={sending} className="w-full sm:w-auto">
            Enviar avaliação
          </Button>
        </form>
      </div>
    </section>
  )
}
