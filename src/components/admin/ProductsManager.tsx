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
import { toSiteMediaUrl } from '@/lib/media/public-url'
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

type ProductVariationForm = {
  id?: string
  name: string
  sku: string
  price: string
  stock: string
  media_id: string | null
  active: boolean
}

type ProductListResponse = {
  items: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [form, setForm] = useState(emptyForm)
  const [variations, setVariations] = useState<ProductVariationForm[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [variationMediaPickerIndex, setVariationMediaPickerIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search.trim()) params.set('q', search.trim())

    const [productsRes, categoriesRes, brandsRes] = await Promise.all([
      fetchApi<ProductListResponse>(`/api/admin/products?${params.toString()}`),
      fetchApi<Category[]>('/api/admin/categories'),
      fetchApi<Brand[]>('/api/admin/brands'),
    ])

    const list = productsRes.data
    setProducts(list?.items ?? [])
    setTotalPages(list?.totalPages ?? 1)
    setTotalProducts(list?.total ?? 0)
    setCategories((categoriesRes.data ?? []).filter((c) => c.active))
    setBrands((brandsRes.data ?? []).filter((b) => b.active))
  }, [page, pageSize, search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function loadVariations(productId: string): Promise<ProductVariationForm[]> {
    const { data } = await fetchApi<
      Array<{
        id: string
        name: string
        sku: string | null
        price: number
        stock: number
        media_id: string | null
        active: boolean
      }>
    >(`/api/admin/products/${productId}/variations`)

    return (data ?? []).map((variation) => ({
      id: variation.id,
      name: variation.name,
      sku: variation.sku ?? '',
      price: String(variation.price),
      stock: String(variation.stock),
      media_id: variation.media_id,
      active: variation.active,
    }))
  }

  async function startEdit(p: Product) {
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
    const loadedVariations = await loadVariations(p.id)
    setVariations(loadedVariations)
    setShowForm(true)
  }

  function cancelForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
    setShowMediaPicker(false)
    setVariationMediaPickerIndex(null)
    setVariations([])
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
    const { data: savedProduct, error: apiError } = await fetchApi<Product>(url, {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })

    if (apiError) {
      setLoading(false)
      setError(apiError)
      return
    }

    const productId = editingId ?? savedProduct?.id
    if (productId) {
      const normalizedVariations = variations
        .map((variation, index) => ({
          name: variation.name.trim(),
          sku: variation.sku.trim() || null,
          price: Number.parseFloat(variation.price),
          stock: Number.parseInt(variation.stock, 10),
          media_id: variation.media_id,
          active: variation.active,
          sort_order: index,
        }))
        .filter(
          (variation) =>
            variation.name &&
            Number.isFinite(variation.price) &&
            variation.price > 0 &&
            Number.isInteger(variation.stock) &&
            variation.stock >= 0
        )

      const { error: variationError } = await fetchApi(`/api/admin/products/${productId}/variations`, {
        method: 'PUT',
        body: JSON.stringify({ variations: normalizedVariations }),
      })

      if (variationError) {
        setLoading(false)
        setError(variationError)
        return
      }
    }

    setLoading(false)

    cancelForm()
    setPage(1)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este produto?')) return
    await fetchApi(`/api/admin/products/${id}`, { method: 'DELETE' })
    load()
  }

  function addVariation() {
    setVariations((current) => [
      ...current,
      {
        name: '',
        sku: '',
        price: '',
        stock: '0',
        media_id: null,
        active: true,
      },
    ])
  }

  function updateVariation(index: number, patch: Partial<ProductVariationForm>) {
    setVariations((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeVariation(index: number) {
    setVariations((current) => current.filter((_, i) => i !== index))
    if (variationMediaPickerIndex === index) setVariationMediaPickerIndex(null)
  }

  return (
    <div className="space-y-6">
      <ProductCsvImport onComplete={load} />

      <div className="flex justify-end">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar produto por nome..."
          className="mr-3 w-[320px]"
        />
        {!showForm && (
          <Button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm)
              setVariations([])
              setShowForm(true)
            }}
          >
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

            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">Variações do produto</legend>
                <Button type="button" variant="secondary" onClick={addVariation}>
                  Adicionar variação
                </Button>
              </div>
              {variations.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Sem variações. Se este produto tiver tamanho/cor/modelos, cadastre aqui.
                </p>
              ) : (
                <div className="space-y-3">
                  {variations.map((variation, index) => (
                    <div key={variation.id ?? `new-${index}`} className="rounded-md border border-border p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          label="Nome da variação"
                          value={variation.name}
                          onChange={(e) => updateVariation(index, { name: e.target.value })}
                          placeholder="Ex.: Azul 2 lugares"
                        />
                        <Input
                          label="SKU da variação"
                          value={variation.sku}
                          onChange={(e) => updateVariation(index, { sku: e.target.value })}
                        />
                        <Input
                          label="Preço da variação"
                          type="number"
                          step="0.01"
                          value={variation.price}
                          onChange={(e) => updateVariation(index, { price: e.target.value })}
                        />
                        <Input
                          label="Estoque da variação"
                          type="number"
                          value={variation.stock}
                          onChange={(e) => updateVariation(index, { stock: e.target.value })}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={variation.active}
                            onChange={(e) => updateVariation(index, { active: e.target.checked })}
                          />
                          Variação ativa
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setVariationMediaPickerIndex((current) => (current === index ? null : index))
                          }
                        >
                          {variationMediaPickerIndex === index ? 'Fechar imagens' : 'Imagem da variação'}
                        </Button>
                        <Button type="button" variant="danger" onClick={() => removeVariation(index)}>
                          Remover variação
                        </Button>
                      </div>

                      {variationMediaPickerIndex === index && (
                        <div className="mt-3 rounded-md border border-border p-3">
                          <MediaLibrary
                            selectable
                            bucket={DEFAULT_PRODUCT_MEDIA_BUCKET}
                            selectedIds={variation.media_id ? [variation.media_id] : []}
                            onSelect={(ids) => updateVariation(index, { media_id: ids[0] ?? null })}
                          />
                        </div>
                      )}
                    </div>
                  ))}
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
        <div className="border-b border-border px-4 py-2 text-sm text-text-secondary">
          {totalProducts} produto(s) encontrado(s)
        </div>
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
              const thumbUrl = toSiteMediaUrl(thumb?.public_url ?? null)
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {thumbUrl && (
                        <div className="relative size-10 shrink-0 overflow-hidden rounded border border-border">
                          <Image src={thumbUrl} alt="" fill sizes="40px" className="object-contain" />
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
