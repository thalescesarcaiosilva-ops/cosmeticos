'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CornerDownRight, GripVertical } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import { createMenuItemSchema, updateMenuItemSchema } from '@/schemas/menu-item-schema'

type MenuItem = {
  id: string
  label: string
  slug: string
  href: string
  parent_id: string | null
  sort_order: number
  visible: boolean
  has_dropdown: boolean
}

type DropIntent = {
  targetId: string
  mode: 'reorder' | 'nest'
}

const emptyForm = {
  label: '',
  slug: '',
  href: '',
  sort_order: '0',
  visible: true,
  has_dropdown: false,
}

function buildDisplayRows(items: MenuItem[]): MenuItem[] {
  const byParent = new Map<string | null, MenuItem[]>()

  for (const item of items) {
    const key = item.parent_id ?? null
    const list = byParent.get(key) ?? []
    list.push(item)
    byParent.set(key, list)
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order)
  }

  const rows: MenuItem[] = []
  const roots = byParent.get(null) ?? []

  for (const root of roots) {
    rows.push(root)
    const children = byParent.get(root.id) ?? []
    rows.push(...children)
  }

  const placed = new Set(rows.map((item) => item.id))
  for (const item of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!placed.has(item.id)) rows.push(item)
  }

  return rows
}

function wouldCreateCycle(itemId: string, parentId: string, items: MenuItem[]): boolean {
  let current: string | null = parentId
  while (current) {
    if (current === itemId) return true
    current = items.find((item) => item.id === current)?.parent_id ?? null
  }
  return false
}

export function MenuItemsManager() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)

  const displayRows = useMemo(() => buildDisplayRows(items), [items])
  const draggingItem = draggingId ? items.find((item) => item.id === draggingId) : null

  const load = useCallback(async () => {
    const { data } = await fetchApi<MenuItem[]>('/api/admin/menu-items')
    setItems(
      (data ?? []).map((item) => ({
        ...item,
        parent_id: item.parent_id ?? null,
      }))
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(item: MenuItem) {
    setEditingId(item.id)
    setForm({
      label: item.label,
      slug: item.slug,
      href: item.href,
      sort_order: String(item.sort_order),
      visible: item.visible,
      has_dropdown: item.has_dropdown,
    })
    setShowForm(true)
  }

  function cancelForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
    setError(null)
  }

  async function persistRows(nextRows: MenuItem[]) {
    setItems(nextRows)
    const { error: apiError } = await fetchApi('/api/admin/menu-items/reorder', {
      method: 'POST',
      body: JSON.stringify({
        items: nextRows.map((item, index) => ({
          id: item.id,
          sort_order: index,
          parent_id: item.parent_id,
        })),
      }),
    })

    if (apiError) {
      setError(apiError)
      load()
      return
    }

    setSuccess('Menu atualizado')
    setTimeout(() => setSuccess(null), 2000)
    load()
  }

  function resolveDropIntent(event: React.DragEvent, target: MenuItem): DropIntent {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const xRatio = (event.clientX - rect.left) / rect.width
    const canNest =
      !target.parent_id &&
      draggingId !== target.id &&
      !wouldCreateCycle(draggingId!, target.id, items) &&
      xRatio > 0.58

    return {
      targetId: target.id,
      mode: canNest ? 'nest' : 'reorder',
    }
  }

  function handleDragStart(id: string) {
    setDraggingId(id)
  }

  function handleDragOver(event: React.DragEvent, target: MenuItem) {
    event.preventDefault()
    if (!draggingId || draggingId === target.id) return
    setDropIntent(resolveDropIntent(event, target))
  }

  function insertAsChild(rows: MenuItem[], dragged: MenuItem, parentId: string): MenuItem[] {
    const next = rows.filter((row) => row.id !== dragged.id)
    const parentIndex = next.findIndex((row) => row.id === parentId)
    if (parentIndex < 0) return rows

    let insertAt = parentIndex + 1
    while (insertAt < next.length && next[insertAt]?.parent_id === parentId) {
      insertAt++
    }

    const moved: MenuItem = { ...dragged, parent_id: parentId }
    next.splice(insertAt, 0, moved)
    return next
  }

  function reorderRows(rows: MenuItem[], draggedId: string, targetId: string): MenuItem[] {
    const next = [...rows]
    const fromIndex = next.findIndex((row) => row.id === draggedId)
    const toIndex = next.findIndex((row) => row.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return rows

    const [moved] = next.splice(fromIndex, 1)
    const target = next.find((row) => row.id === targetId)
    const insertAt = next.findIndex((row) => row.id === targetId)

    const becomesChild = Boolean(target?.parent_id)
    const updated: MenuItem = {
      ...moved,
      parent_id: becomesChild ? target!.parent_id : null,
    }

    next.splice(insertAt, 0, updated)
    return next
  }

  function handleDrop(target: MenuItem) {
    if (!draggingId || !dropIntent || draggingId === target.id) {
      setDraggingId(null)
      setDropIntent(null)
      return
    }

    const dragged = items.find((item) => item.id === draggingId)
    if (!dragged) return

    let nextRows = [...displayRows]

    if (dropIntent.mode === 'nest') {
      nextRows = insertAsChild(nextRows, dragged, target.id)
    } else {
      nextRows = reorderRows(nextRows, draggingId, target.id)
    }

    const normalized = nextRows.map((row, index) => ({ ...row, sort_order: index }))
    void persistRows(normalized)

    setDraggingId(null)
    setDropIntent(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropIntent(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = {
      label: form.label.trim(),
      slug: form.slug.trim(),
      href: form.href.trim(),
      sort_order: parseInt(form.sort_order, 10),
      visible: form.visible,
      has_dropdown: form.has_dropdown,
    }

    const parsed = editingId
      ? updateMenuItemSchema.safeParse(payload)
      : createMenuItemSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingId ? `/api/admin/menu-items/${editingId}` : '/api/admin/menu-items'
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
    if (!confirm('Remover este item?')) return
    await fetchApi(`/api/admin/menu-items/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        Arraste pela esquerda para <strong>reordenar</strong>. Arraste para a{' '}
        <strong>direita</strong> de um item principal para colocá-lo dentro do dropdown.
      </p>

      <div className="flex justify-end">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            Novo item
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {showForm && (
        <Card title={editingId ? 'Editar item' : 'Novo item'}>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
            />
            <Input
              label="Href"
              value={form.href}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
              className="sm:col-span-2"
              required
            />
            <Input
              label="Ordem"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) => setForm({ ...form, visible: e.target.checked })}
              />
              Visível
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.has_dropdown}
                onChange={(e) => setForm({ ...form, has_dropdown: e.target.checked })}
              />
              Dropdown no header
            </label>
            <div className="flex gap-3 sm:col-span-2">
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

      <ul className="space-y-2">
        {displayRows.map((item) => {
          const isNestTarget =
            dropIntent?.mode === 'nest' &&
            dropIntent.targetId === item.id &&
            draggingId !== item.id
          const isReorderTarget =
            dropIntent?.mode === 'reorder' &&
            dropIntent.targetId === item.id &&
            draggingId !== item.id

          return (
            <li key={item.id} className="space-y-2">
              <div
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(event) => handleDragOver(event, item)}
                onDrop={() => handleDrop(item)}
                onDragEnd={handleDragEnd}
                style={{ marginLeft: item.parent_id ? '2rem' : undefined }}
                className={`relative flex items-center gap-3 rounded-lg border bg-surface px-3 py-3 transition-colors ${
                  isNestTarget
                    ? 'border-brand ring-2 ring-brand/20'
                    : isReorderTarget
                      ? 'border-brand/60 bg-brand/5'
                      : draggingId === item.id
                        ? 'border-border opacity-60'
                        : 'border-border'
                }`}
              >
                {!item.parent_id && (
                  <div
                    className="pointer-events-none absolute inset-y-2 right-3 w-[28%] rounded-md border border-dashed border-transparent"
                    aria-hidden
                  >
                    <div
                      className={`flex h-full items-center justify-end pr-2 text-[10px] font-medium uppercase tracking-wide ${
                        isNestTarget ? 'text-brand' : 'text-transparent'
                      }`}
                    >
                      Dropdown
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="cursor-grab text-text-muted hover:text-text-primary active:cursor-grabbing"
                  aria-label={`Arrastar ${item.label}`}
                >
                  <GripVertical className="size-5" aria-hidden />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.parent_id && (
                      <CornerDownRight className="size-4 text-brand" aria-hidden />
                    )}
                    <p className="font-medium text-text-primary">{item.label}</p>
                    {item.has_dropdown && !item.parent_id && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                        Dropdown
                      </span>
                    )}
                    {item.parent_id && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                        Subitem
                      </span>
                    )}
                    {!item.visible && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        Oculto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">{item.href}</p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="ghost" onClick={() => startEdit(item)}>
                    Editar
                  </Button>
                  <Button type="button" variant="danger" onClick={() => handleDelete(item.id)}>
                    Remover
                  </Button>
                </div>
              </div>

              {isNestTarget && draggingItem && (
                <div
                  className="ml-8 rounded-lg border border-dashed border-brand bg-brand/5 px-4 py-3"
                  style={{ marginLeft: '2rem' }}
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-brand">
                    <CornerDownRight className="size-4" aria-hidden />
                    Entrar no dropdown de &quot;{item.label}&quot;
                  </p>
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-brand/30 bg-surface px-3 py-2 text-sm text-text-secondary shadow-sm">
                    <GripVertical className="size-4 text-text-muted" aria-hidden />
                    {draggingItem.label}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
