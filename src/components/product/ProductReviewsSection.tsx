'use client'

import { useState } from 'react'
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
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="text-lg font-bold text-text-primary">Avaliações</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Comentários enviados aqui passam por aprovação antes de aparecer.
      </p>

      <div className="mt-5 space-y-3">
        {reviews.length === 0 ? (
          <p className="text-sm text-text-muted">Este produto ainda não possui avaliações aprovadas.</p>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-border bg-surface p-4">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-text-primary">{review.author_name}</p>
                <p className="text-xs text-text-muted">
                  {new Date(review.created_at).toLocaleDateString('pt-BR')}
                </p>
              </header>
              <p className="mt-1 text-sm text-amber-600">{'★'.repeat(review.rating)}</p>
              {review.title && <p className="mt-2 font-medium text-text-primary">{review.title}</p>}
              <p className="mt-1 text-sm text-text-secondary">{review.comment}</p>
            </article>
          ))
        )}
      </div>

      <form className="mt-6 space-y-3 rounded-lg border border-border bg-surface-muted p-4" onSubmit={handleSubmit}>
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

        <Button type="submit" loading={sending}>
          Enviar avaliação
        </Button>
      </form>
    </section>
  )
}
