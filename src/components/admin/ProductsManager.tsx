'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { MediaLibrary } from '@/components/admin/MediaLibrary'
import { DEFAULT_PRODUCT_MEDIA_BUCKET } from '@/lib/media/buckets'
import { ProductCsvImport } from '@/components/admin/ProductCsvImport'
import { ProductImageOrder } from '@/components/admin/ProductImageOrder'
import { fetchApi } from '@/lib/api/fetch-api'
import { slugify } from '@/lib/products/format'
import { createProductSchema, updateProductSchema } from '@/schemas/product-schema'
import type { Brand, Product } from '@/types/product'

type Category = { id: string; name: string; slug: string; active: boolean }

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  price: '',
  original_price: '',
  stock: '0',
  brand_id: '',
  sku: '',
  gtin: '',
  meta_title: '',
  meta_description: '',
  active: true,
  category_ids: [] as string[],
  media_ids: [] as string[],
}

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [productsRes, categoriesRes, brandsRes] = await Promise.all([
      fetchApi<Product[]>('/api/admin/products'),
      fetchApi<Category[]>('/api/admin/categories'),
      fetchApi<Brand[]>('/api/admin/brands'),
    ])
    setProducts(productsRes.data ?? [])
    setCategories((categoriesRes.data ?? []).filter((c) => c.active))
    setBrands((brandsRes.data ?? []).filter((b) => b.active))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      price: String(p.price),
      original_price: p.original_price != null ? String(p.original_price) : '',
      stock: String(p.stock),
      brand_id: p.brand_id ?? '',
      sku: p.sku ?? '',
      gtin: p.gtin ?? '',
      meta_title: p.meta_title ?? '',
      meta_description: p.meta_description ?? '',
      active: p.active,
      category_ids: p.product_categories?.map((pc) => pc.category_id) ?? [],
      media_ids:
        p.product_images
          ?.sort((a, b) => a.sort_order - b.sort_order)
          .map((pi) => pi.media.id) ?? [],
    })
    setShowForm(true)
  }

  function cancelForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
    setShowMediaPicker(false)
    setError(null)
  }

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      category_ids: f.category_ids.includes(id)
        ? f.category_ids.filter((c) => c !== id)
        : [...f.category_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      stock: parseInt(form.stock, 10),
      brand_id: form.brand_id || null,
      sku: form.sku.trim() || null,
      gtin: form.gtin.trim() || null,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      active: form.active,
      category_ids: form.category_ids,
      media_ids: form.media_ids,
    }

    const parsed = editingId
      ? updateProductSchema.safeParse(payload)
      : createProductSchema.safeParse(payload)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products'
    const { error: apiError } = await fetchApi(url, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    cancelForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este produto?')) return
    await fetchApi(`/api/admin/products/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <ProductCsvImport onComplete={load} />

      <div className="flex justify-end">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Novo produto
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {showForm && (
        <Card title={editingId ? 'Editar produto' : 'Novo produto'}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Título"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: form.slug || slugify(e.target.value),
                  })
                }
                required
              />
              <Input
                label="Slug (URL: /produto/slug)"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
              />
              <div>
                <label className="mb-1 block text-sm font-medium">Marca</label>
                <select
                  className="w-full rounded-md border border-border px-3 py-2.5 text-sm"
                  value={form.brand_id}
                  onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                >
                  <option value="">Sem marca</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="SKU / Código"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
              <Input
                label="Preço"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              <Input
                label="Preço original (De)"
                type="number"
                step="0.01"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
              />
              <Input
                label="Estoque"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                required
              />
              <Input
                label="GTIN / EAN"
                value={form.gtin}
                onChange={(e) => setForm({ ...form, gtin: e.target.value })}
              />
            </div>

            <Textarea
              label="Descrição completa"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={8}
            />

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Categorias</legend>
              {categories.length === 0 ? (
                <p className="text-sm text-text-secondary">Cadastre categorias ativas primeiro.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.category_ids.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Imagens</legend>
              <p className="mb-2 text-xs text-text-muted">
                Selecione na biblioteca e defina a ordem abaixo. A primeira é a capa.
              </p>
              <Button type="button" variant="secondary" onClick={() => setShowMediaPicker((v) => !v)}>
                {showMediaPicker ? 'Fechar biblioteca' : 'Selecionar imagens'}
              </Button>
              <ProductImageOrder
                mediaIds={form.media_ids}
                onChange={(ids) => setForm({ ...form, media_ids: ids })}
              />
              {showMediaPicker && (
                <div className="mt-4 rounded-lg border border-border p-4">
                  <MediaLibrary
                    selectable
                    bucket={DEFAULT_PRODUCT_MEDIA_BUCKET}
                    selectedIds={form.media_ids}
                    onSelect={(ids) => setForm({ ...form, media_ids: ids })}
                  />
                </div>
              )}
            </fieldset>

            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Input
                label="Meta title (SEO)"
                value={form.meta_title}
                onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                maxLength={70}
              />
              <Input
                label="Meta description (SEO)"
                value={form.meta_description}
                onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                maxLength={160}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Produto ativo (visível na loja)
            </label>

            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                Salvar
              </Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Produto</th>
              <th className="px-4 py-3 text-left font-semibold">Preço</th>
              <th className="px-4 py-3 text-left font-semibold">Estoque</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const thumb = p.product_images?.sort((a, b) => a.sort_order - b.sort_order)[0]?.media
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {thumb?.public_url && (
                        <div className="relative size-10 shrink-0 overflow-hidden rounded border border-border">
                          <Image src={thumb.public_url} alt="" fill sizes="40px" className="object-contain" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-text-muted">/produto/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">R$ {Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3">{p.stock}</td>
                  <td className="px-4 py-3">{p.active ? 'Ativo' : 'Inativo'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" onClick={() => startEdit(p)}>
                      Editar
                    </Button>
                    <Button type="button" variant="danger" onClick={() => handleDelete(p.id)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
