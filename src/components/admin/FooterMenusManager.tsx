'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  createFooterMenuSchema,
  updateFooterMenuSchema,
} from '@/schemas/footer-menu-schema'

type FooterMenuItem = {
  id: string
  menu_id: string
  label: string
  href: string
  sort_order: number
  active: boolean
}

type FooterMenu = {
  id: string
  title: string
  sort_order: number
  active: boolean
  items: FooterMenuItem[]
}

const emptyMenuForm = { title: '', sort_order: 0, active: true }
const emptyItemForm = { label: '', href: '', sort_order: 0, active: true }

export function FooterMenusManager() {
  const [menus, setMenus] = useState<FooterMenu[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [migrationHint, setMigrationHint] = useState(false)

  const [showMenuForm, setShowMenuForm] = useState(false)
  const [menuForm, setMenuForm] = useState(emptyMenuForm)
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null)

  const [addingItemMenuId, setAddingItemMenuId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: apiError } = await fetchApi<FooterMenu[]>('/api/admin/footer-menus')
    if (apiError) {
      setError(apiError)
      setMigrationHint(apiError.includes('migration'))
      setMenus([])
      return
    }
    setError(null)
    setMigrationHint(false)
    setMenus(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function resetMenuForm() {
    setMenuForm(emptyMenuForm)
    setEditingMenuId(null)
    setShowMenuForm(false)
  }

  function resetItemForm() {
    setItemForm(emptyItemForm)
    setEditingItemId(null)
    setAddingItemMenuId(null)
  }

  async function saveMenu(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = {
      title: menuForm.title.trim(),
      sort_order: menuForm.sort_order,
      active: menuForm.active,
    }

    const parsed = editingMenuId
      ? updateFooterMenuSchema.safeParse(payload)
      : createFooterMenuSchema.safeParse(payload)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    setLoading(true)
    const url = editingMenuId
      ? `/api/admin/footer-menus/${editingMenuId}`
      : '/api/admin/footer-menus'
    const { error: apiError } = await fetchApi(url, {
      method: editingMenuId ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    resetMenuForm()
    load()
  }

  async function deleteMenu(id: string) {
    if (!confirm('Remover este menu e todos os links?')) return
    await fetchApi(`/api/admin/footer-menus/${id}`, { method: 'DELETE' })
    load()
  }

  async function saveItem(e: React.FormEvent, menuId: string) {
    e.preventDefault()
    setError(null)

    const payload = {
      menu_id: menuId,
      label: itemForm.label.trim(),
      href: itemForm.href.trim(),
      sort_order: itemForm.sort_order,
      active: itemForm.active,
    }

    setLoading(true)

    if (editingItemId) {
      const { error: apiError } = await fetchApi(`/api/admin/footer-menu-items/${editingItemId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: payload.label,
          href: payload.href,
          sort_order: payload.sort_order,
          active: payload.active,
        }),
      })
      setLoading(false)
      if (apiError) {
        setError(apiError)
        return
      }
    } else {
      const { error: apiError } = await fetchApi('/api/admin/footer-menus', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setLoading(false)
      if (apiError) {
        setError(apiError)
        return
      }
    }

    resetItemForm()
    load()
  }

  async function deleteItem(id: string) {
    if (!confirm('Remover este link?')) return
    await fetchApi(`/api/admin/footer-menu-items/${id}`, { method: 'DELETE' })
    load()
  }

  function startEditMenu(menu: FooterMenu) {
    setEditingMenuId(menu.id)
    setMenuForm({
      title: menu.title,
      sort_order: menu.sort_order,
      active: menu.active,
    })
    setShowMenuForm(true)
  }

  function startEditItem(item: FooterMenuItem) {
    setEditingItemId(item.id)
    setAddingItemMenuId(item.menu_id)
    setItemForm({
      label: item.label,
      href: item.href,
      sort_order: item.sort_order,
      active: item.active,
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        Crie colunas de menu no rodapé com título, posição e links (texto + URL). Ex.:{' '}
        <code className="text-xs">/paginas/politica-de-privacidade</code> ou{' '}
        <code className="text-xs">/fale-conosco</code>.
      </p>

      {migrationHint && (
        <Alert type="error">
          Execute{' '}
          <code className="text-xs">supabase/migrations/202507020004_footer_menus.sql</code> no
          Supabase.
        </Alert>
      )}

      {error && !migrationHint && <Alert type="error">{error}</Alert>}

      <div className="flex justify-end">
        {!showMenuForm && (
          <Button type="button" onClick={() => setShowMenuForm(true)}>
            Novo menu
          </Button>
        )}
      </div>

      {showMenuForm && (
        <Card title={editingMenuId ? 'Editar menu' : 'Novo menu'}>
          <form onSubmit={saveMenu} className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Título do menu"
              value={menuForm.title}
              onChange={(e) => setMenuForm({ ...menuForm, title: e.target.value })}
              required
              className="sm:col-span-2"
            />
            <Input
              label="Posição"
              type="number"
              min={0}
              value={menuForm.sort_order}
              onChange={(e) =>
                setMenuForm({ ...menuForm, sort_order: parseInt(e.target.value, 10) || 0 })
              }
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input
                type="checkbox"
                checked={menuForm.active}
                onChange={(e) => setMenuForm({ ...menuForm, active: e.target.checked })}
              />
              Menu ativo no rodapé
            </label>
            <div className="flex gap-3 sm:col-span-3">
              <Button type="submit" loading={loading}>
                Salvar menu
              </Button>
              <Button type="button" variant="secondary" onClick={resetMenuForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {menus.map((menu) => (
          <Card key={menu.id}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{menu.title}</h3>
                <p className="text-xs text-text-secondary">
                  Posição {menu.sort_order}
                  {!menu.active && ' · inativo'}
                  {' · '}
                  {menu.items.length} link(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => startEditMenu(menu)}>
                  Editar
                </Button>
                <Button type="button" variant="danger" onClick={() => deleteMenu(menu.id)}>
                  Remover
                </Button>
              </div>
            </div>

            <ul className="space-y-2">
              {menu.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-text-muted">
                      {item.href} · pos. {item.sort_order}
                      {!item.active && ' · inativo'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => startEditItem(item)}>
                      Editar
                    </Button>
                    <Button type="button" variant="danger" onClick={() => deleteItem(item.id)}>
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {addingItemMenuId === menu.id ? (
              <form
                onSubmit={(e) => saveItem(e, menu.id)}
                className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
              >
                <Input
                  label="Texto do link"
                  value={itemForm.label}
                  onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                  required
                />
                <Input
                  label="URL"
                  value={itemForm.href}
                  onChange={(e) => setItemForm({ ...itemForm, href: e.target.value })}
                  required
                  placeholder="/paginas/sobre-a-loja"
                />
                <Input
                  label="Posição"
                  type="number"
                  min={0}
                  value={itemForm.sort_order}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, sort_order: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.active}
                    onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                  />
                  Link ativo
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" loading={loading}>
                    {editingItemId ? 'Salvar link' : 'Adicionar link'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetItemForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  resetItemForm()
                  setAddingItemMenuId(menu.id)
                }}
              >
                Adicionar link
              </Button>
            )}
          </Card>
        ))}

        {menus.length === 0 && !migrationHint && (
          <Card>
            <p className="text-sm text-text-secondary">
              Nenhum menu configurado. Crie um menu ou aplique a migration para importar os menus
              existentes.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
