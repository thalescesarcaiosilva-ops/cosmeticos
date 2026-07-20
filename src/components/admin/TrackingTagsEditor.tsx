'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  TRACKING_PLACEMENT_LABELS,
  TRACKING_PLACEMENTS,
  type TrackingPlacement,
  type TrackingTag,
} from '@/types/tracking-tags'

type TrackingTagsEditorProps = {
  tags: TrackingTag[]
  onChange: (tags: TrackingTag[]) => void
}

const PRESETS: {
  label: string
  name: string
  placement: TrackingPlacement
  html: string
}[] = [
  {
    label: 'GTM (head)',
    name: 'Google Tag Manager — head',
    placement: 'head',
    html: `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->`,
  },
  {
    label: 'GTM (body)',
    name: 'Google Tag Manager — body',
    placement: 'body',
    html: `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`,
  },
  {
    label: 'GA4',
    name: 'Google Analytics 4',
    placement: 'head',
    html: `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`,
  },
  {
    label: 'Conversão checkout',
    name: 'Marcação de conversão / pagamento',
    placement: 'checkout',
    html: `<!-- Cole aqui a tag de conversão do Google Ads / pagamento (thank you / checkout) -->
<script>
  // Exemplo: gtag('event', 'conversion', { send_to: 'AW-XXXXXX/YYYY' });
</script>`,
  },
]

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `tag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function TrackingTagsEditor({ tags, onChange }: TrackingTagsEditorProps) {
  function addBlank() {
    onChange([
      ...tags,
      {
        id: createId(),
        name: 'Nova tag',
        placement: 'head',
        enabled: true,
        html: '',
      },
    ])
  }

  function addPreset(preset: (typeof PRESETS)[number]) {
    onChange([
      ...tags,
      {
        id: createId(),
        name: preset.name,
        placement: preset.placement,
        enabled: true,
        html: preset.html,
      },
    ])
  }

  function updateTag(id: string, patch: Partial<TrackingTag>) {
    onChange(tags.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)))
  }

  function removeTag(id: string) {
    onChange(tags.filter((tag) => tag.id !== id))
  }

  return (
    <div className="space-y-4">
      <Card title="Tags e scripts">
        <p className="mb-4 text-sm text-text-secondary">
          Adicione quantas tags quiser: Google Tag Manager, Analytics, Meta Pixel, marcação de
          pagamento no checkout, etc. Elas não aparecem no painel admin.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={addBlank}>
            + Adicionar tag
          </Button>
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="secondary"
              onClick={() => addPreset(preset)}
            >
              Modelo: {preset.label}
            </Button>
          ))}
        </div>

        {tags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-text-secondary">
            Nenhuma tag cadastrada. Use um modelo ou adicione uma tag em branco.
          </p>
        ) : (
          <ul className="space-y-4">
            {tags.map((tag, index) => (
              <li
                key={tag.id}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    Tag {index + 1}
                    {!tag.enabled && (
                      <span className="ml-2 text-xs font-normal text-text-muted">(desativada)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={tag.enabled}
                        onChange={(e) => updateTag(tag.id, { enabled: e.target.checked })}
                      />
                      Ativa
                    </label>
                    <Button type="button" variant="secondary" onClick={() => removeTag(tag.id)}>
                      Remover
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Nome"
                    value={tag.name}
                    onChange={(e) => updateTag(tag.id, { name: e.target.value })}
                    placeholder="Ex.: Google Tag Manager"
                  />
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium text-text-primary">Onde injetar</span>
                    <select
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary"
                      value={tag.placement}
                      onChange={(e) =>
                        updateTag(tag.id, {
                          placement: e.target.value as TrackingPlacement,
                        })
                      }
                    >
                      {TRACKING_PLACEMENTS.map((placement) => (
                        <option key={placement} value={placement}>
                          {TRACKING_PLACEMENT_LABELS[placement]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3">
                  <Textarea
                    label="HTML / script"
                    value={tag.html}
                    onChange={(e) => updateTag(tag.id, { html: e.target.value })}
                    rows={8}
                    className="font-mono text-xs leading-relaxed"
                    placeholder="Cole o snippet completo do provedor (script, noscript, meta…)"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-text-muted">
          Locais: <strong>head</strong> e <strong>body</strong> em todas as páginas da loja;{' '}
          <strong>checkout</strong> só em /checkout e na página de obrigado. Aceita até 50 tags.
          Tags <code>&lt;script&gt;</code>, <code>&lt;noscript&gt;</code>, <code>&lt;meta&gt;</code>,{' '}
          <code>&lt;link&gt;</code>, <code>&lt;style&gt;</code> e <code>&lt;iframe&gt;</code>.
        </p>
      </Card>
    </div>
  )
}
