'use client'

import { useMemo, useState } from 'react'
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
  reviewSummary: { average: number; count: number }
}

const emptyForm = {
  author_name: '',
  author_email: '',
  rating: '5',
  title: '',
  comment: '',
}

function ReviewStars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
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

function buildDistribution(reviews: ApprovedProductReview[]) {
  const counts = [0, 0, 0, 0, 0]
  for (const review of reviews) {
    const bucket = Math.min(5, Math.max(1, Math.round(review.rating))) - 1
    counts[bucket] += 1
  }
  return counts
}

export function ProductReviewsSection({
  productSlug,
  reviews,
  reviewSummary,
}: ProductReviewsSectionProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const distribution = useMemo(() => buildDistribution(reviews), [reviews])
  const recommendRate = useMemo(() => {
    if (reviews.length === 0) return null
    const positive = reviews.filter((review) => review.rating >= 4).length
    return Math.round((positive / reviews.length) * 100)
  }, [reviews])

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
      <header className="mb-6">
        <h2 className="text-xl font-bold text-text-primary md:text-2xl">Avaliações</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          Opiniões verificadas de clientes. Novos comentários passam por moderação antes de
          aparecer.
        </p>
      </header>

      <div className="mb-8 rounded-xl border border-border bg-cream/50 p-4 md:p-5">
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-10">
          <div className="text-center md:min-w-[140px] md:text-left">
            <p className="text-[42px] font-bold leading-none tracking-tight text-text-primary tabular-nums">
              {reviewSummary.count > 0 ? reviewSummary.average.toFixed(1) : '—'}
            </p>
            <div className="mt-2 flex justify-center md:justify-start">
              <ReviewStars
                rating={reviewSummary.count > 0 ? Math.round(reviewSummary.average) : 0}
                size={18}
              />
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              {reviewSummary.count === 0
                ? 'Nenhuma avaliação ainda'
                : `${reviewSummary.count} avaliação${reviewSummary.count === 1 ? '' : 'ões'}`}
            </p>
            {recommendRate != null && (
              <p className="mt-1 text-[12px] font-medium text-text-muted">
                {recommendRate}% recomendam (4★ ou mais)
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars - 1] ?? 0
              const pct =
                reviewSummary.count > 0 ? Math.round((count / reviewSummary.count) * 100) : 0
              return (
                <div key={stars} className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <span className="w-6 tabular-nums">{stars}★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className="h-full rounded-full bg-[#c4a035]/40"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-text-muted">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <ul className="mt-5 grid gap-2 border-t border-border/70 pt-4 text-[12px] text-text-secondary sm:grid-cols-3">
          <li>Comentários publicados após aprovação</li>
          <li>Notas de 1 a 5 estrelas</li>
          <li>Ajuda outros clientes na decisão de compra</li>
        </ul>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10">
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-8 text-sm text-text-secondary">
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
          className="h-fit space-y-3 rounded-xl border border-border bg-surface p-4 md:p-5"
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
