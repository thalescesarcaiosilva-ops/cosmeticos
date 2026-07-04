'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import type { HomeBanner } from '@/types/home-banner'
import type { BannerDeviceTarget } from '@/schemas/banner-schema'

const DEVICE_TARGET_OPTIONS: { value: BannerDeviceTarget; label: string; hint: string }[] = [
  {
    value: 'both',
    label: 'Desktop e mobile',
    hint: 'Mesma imagem nos dois dispositivos',
  },
  {
    value: 'desktop',
    label: 'Apenas desktop',
    hint: 'Exibido em telas médias e grandes',
  },
  {
    value: 'mobile',
    label: 'Apenas mobile',
    hint: 'Exibido em telas pequenas',
  },
]

function deviceTargetLabel(value: BannerDeviceTarget) {
  return DEVICE_TARGET_OPTIONS.find((opt) => opt.value === value)?.label ?? value
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function BannersManager() {
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    alt_text: '',
    link_href: '',
    active: true,
    device_target: 'both' as BannerDeviceTarget,
  })

  const load = useCallback(async () => {
    const { data } = await fetchApi<HomeBanner[]>('/api/admin/banners')
    setBanners(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setForm({
      title: '',
      alt_text: '',
      link_href: '',
      active: true,
      device_target: 'both',
    })
    setEditingId(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const file = fileRef.current?.files?.[0]
    if (!editingId && !file) {
      setError('Selecione uma imagem para o banner')
      return
    }

    setLoading(true)

    const payload = {
      title: form.title.trim() || 'Banner',
      alt_text: form.alt_text.trim() || null,
      link_href: form.link_href.trim() || null,
      active: form.active,
      device_target: form.device_target,
    }

    if (editingId && !file) {
      const { error: apiError, message: apiMessage } = await fetchApi(
        `/api/admin/banners/${editingId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
      setLoading(false)
      if (apiError) {
        setError(apiError)
        return
      }
      setMessage(apiMessage ?? 'Salvo com sucesso')
      resetForm()
      await load()
      return
    }

    const formData = new FormData()
    if (file) formData.append('file', file)
    formData.append('title', payload.title)
    formData.append('alt_text', payload.alt_text ?? '')
    formData.append('link_href', payload.link_href ?? '')
    formData.append('active', String(payload.active))
    formData.append('device_target', payload.device_target)

    const url = editingId ? `/api/admin/banners/${editingId}` : '/api/admin/banners'

    try {
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        body: formData,
      })
      const json = (await res.json()) as { error?: boolean; message?: string }

      if (json.error) {
        setError(json.message ?? 'Erro ao salvar')
        setLoading(false)
        return
      }

      setMessage(json.message ?? 'Salvo com sucesso')
      resetForm()
      await load()
    } catch {
      setError('Algo deu errado, tente novamente')
    }

    setLoading(false)
  }

  function startEdit(banner: HomeBanner) {
    setEditingId(banner.id)
    setForm({
      title: banner.title,
      alt_text: banner.alt_text ?? '',
      link_href: banner.link_href ?? '',
      active: banner.active,
      device_target: banner.device_target ?? 'both',
    })
    if (fileRef.current) fileRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function moveBanner(id: string, direction: -1 | 1) {
    const idx = banners.findIndex((b) => b.id === id)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= banners.length) return

    const next = [...banners]
    ;[next[idx], next[target]] = [next[target], next[idx]]

    setBanners(next)

    await Promise.all(
      next.map((banner, sort_order) =>
        fetchApi(`/api/admin/banners/${banner.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ sort_order }),
        })
      )
    )
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este banner?')) return
    setError(null)
    const { error: apiError } = await fetchApi(`/api/admin/banners/${id}`, { method: 'DELETE' })
    if (apiError) {
      setError(apiError)
      return
    }
    if (editingId === id) resetForm()
    load()
  }

  async function toggleActive(banner: HomeBanner) {
    await fetchApi(`/api/admin/banners/${banner.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !banner.active }),
    })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Banners da home</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Imagens são convertidas para WebP e redimensionadas para melhor desempenho. Defina se cada
          banner aparece no desktop, no mobile ou em ambos com a mesma imagem.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Título interno"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: Promo verão"
          />
          <Input
            label="Texto alternativo (acessibilidade / SEO)"
            value={form.alt_text}
            onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
            placeholder="Descrição da imagem"
          />
          <Input
            label="Link ao clicar"
            value={form.link_href}
            onChange={(e) => setForm({ ...form, link_href: e.target.value })}
            placeholder="/colecoes/lancamentos ou https://..."
          />
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-text-primary">Exibir em</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {DEVICE_TARGET_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-colors ${
                    form.device_target === option.value
                      ? 'border-brand bg-brand/5'
                      : 'border-border hover:border-brand/40'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <input
                      type="radio"
                      name="device_target"
                      value={option.value}
                      checked={form.device_target === option.value}
                      onChange={() => setForm({ ...form, device_target: option.value })}
                    />
                    {option.label}
                  </span>
                  <span className="mt-1 pl-6 text-xs text-text-muted">{option.hint}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">
              Imagem {editingId ? '(opcional — substituir)' : '(obrigatória)'}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            <p className="mt-1 text-xs text-text-muted">
              JPEG, PNG ou WebP. Desktop: ~1920×560 px. Mobile: ~1080×1350 px ou proporção vertical.
              Máx. 8 MB antes da otimização.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Ativo na loja
          </label>
          <Button type="submit" loading={loading}>
            {editingId ? 'Salvar alterações' : 'Adicionar banner'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-3 text-left">Preview</th>
              <th className="px-4 py-3 text-left">Título / link</th>
              <th className="px-4 py-3 text-left">Dispositivo</th>
              <th className="px-4 py-3 text-left">Tamanho</th>
              <th className="px-4 py-3 text-left">Ordem</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {banners.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  Nenhum banner cadastrado.
                </td>
              </tr>
            ) : (
              banners.map((banner, index) => (
                <tr key={banner.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="relative h-14 w-28 overflow-hidden rounded border border-border bg-surface-muted">
                      <Image
                        src={banner.image_url}
                        alt={banner.alt_text ?? banner.title}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{banner.title}</p>
                    <p className="truncate text-xs text-text-muted">
                      {banner.link_href || 'Sem link'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {deviceTargetLabel(banner.device_target ?? 'both')}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {banner.width && banner.height
                      ? `${banner.width}×${banner.height}`
                      : '—'}{' '}
                    · {formatBytes(banner.file_size)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        disabled={index === 0}
                        onClick={() => moveBanner(banner.id, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        disabled={index === banners.length - 1}
                        onClick={() => moveBanner(banner.id, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(banner)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        banner.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-surface-muted text-text-muted'
                      }`}
                    >
                      {banner.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => startEdit(banner)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs text-red-600"
                        onClick={() => handleDelete(banner.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
