'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  EMPTY_TRACKING_CONFIG,
  listAdsConversionSendTos,
  listGoogleConfigIds,
  MAX_ADS_CONVERSIONS,
  type StoreTrackingConfig,
} from '@/lib/seo/analytics'
import type { TrackingTag } from '@/types/tracking-tags'

type TrackingPixelsPanelProps = {
  tracking: StoreTrackingConfig
  trackingTags: TrackingTag[]
  onChange: (tracking: StoreTrackingConfig) => void
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        active
          ? 'bg-success/15 text-success'
          : 'bg-surface-muted text-text-muted'
      }`}
    >
      {active ? 'Ativo' : 'Vazio'} · {label}
    </span>
  )
}

function detectHtmlOverlap(tags: TrackingTag[]) {
  const enabled = tags.filter((t) => t.enabled)
  const hasGa = enabled.some(
    (t) =>
      /gtag\/js\?id=G-/i.test(t.html) ||
      /gtag\(['"]config['"]\s*,\s*['"]G-/i.test(t.html)
  )
  const hasAwConfig = enabled.some((t) => /gtag\(['"]config['"]\s*,\s*['"]AW-/i.test(t.html))
  const hasClarity = enabled.some((t) => /clarity\.ms\/tag\//i.test(t.html))
  const hasConversionSnippet = enabled.some(
    (t) =>
      t.placement === 'checkout' ||
      (/gtag\(['"]event['"]\s*,\s*['"]conversion['"]/i.test(t.html) &&
        /send_to/i.test(t.html))
  )
  const gtmCount = enabled.filter((t) => /googletagmanager\.com\/gtm\.js/i.test(t.html) || /GTM-/i.test(t.html)).length

  return { hasGa, hasAwConfig, hasClarity, hasConversionSnippet, gtmCount, enabledCount: enabled.length }
}

export function TrackingPixelsPanel({
  tracking,
  trackingTags,
  onChange,
}: TrackingPixelsPanelProps) {
  const safe = { ...EMPTY_TRACKING_CONFIG, ...tracking }
  const conversions = listAdsConversionSendTos(safe)
  const googleIds = listGoogleConfigIds(safe)
  const overlap = detectHtmlOverlap(trackingTags)

  function patch(partial: Partial<StoreTrackingConfig>) {
    const next = normalizeLocal({ ...safe, ...partial })
    onChange(next)
  }

  function normalizeLocal(cfg: StoreTrackingConfig): StoreTrackingConfig {
    const sendTos = listAdsConversionSendTos(cfg)
    return {
      ...EMPTY_TRACKING_CONFIG,
      ...cfg,
      googleAdsConversionSendTo: sendTos[0] ?? null,
      googleAdsConversionSendTos: sendTos,
    }
  }

  function updateConversion(index: number, value: string) {
    const next = [...conversions]
    next[index] = value
    patch({ googleAdsConversionSendTos: next, googleAdsConversionSendTo: next[0] ?? null })
  }

  function addConversion() {
    if (conversions.length >= MAX_ADS_CONVERSIONS) return
    patch({
      googleAdsConversionSendTos: [...conversions, ''],
      googleAdsConversionSendTo: conversions[0] ?? null,
    })
  }

  function removeConversion(index: number) {
    const next = conversions.filter((_, i) => i !== index)
    patch({
      googleAdsConversionSendTos: next,
      googleAdsConversionSendTo: next[0] ?? null,
    })
  }

  return (
    <div className="space-y-6">
      <Card title="Como funciona o tracking desta loja">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text-secondary">
          <li>
            <strong className="text-text-primary">Pixels (esta seção)</strong> — IDs tipados. A loja
            carrega sozinha o gtag (GA4/Ads) e o Clarity em todas as páginas da vitrine.
          </li>
          <li>
            <strong className="text-text-primary">Conversão de compra</strong> — quando o pedido fica{' '}
            <strong>pago</strong> na página de obrigado, dispara{' '}
            <code className="text-xs">gtag(&apos;event&apos;,&apos;conversion&apos;)</code> com valor
            real + ID do pedido. Pode ter até {MAX_ADS_CONVERSIONS} ações (ex.: Compra + outra
            conversão).
          </li>
          <li>
            <strong className="text-text-primary">Tags e scripts (abaixo)</strong> — HTML livre só
            para o que <em>não</em> tem campo tipado (ex.: GTM, Meta Pixel). Não cole GA4, Clarity
            nem snippet de Compra aqui — gera duplicata.
          </li>
        </ol>
      </Card>

      <Card title="Status do que está ativo">
        <div className="flex flex-wrap gap-2">
          <StatusPill active={Boolean(safe.googleTagId)} label="Google Tag" />
          <StatusPill active={Boolean(safe.googleAnalyticsId)} label="GA4" />
          <StatusPill active={Boolean(safe.googleAdsId)} label="Google Ads" />
          <StatusPill
            active={conversions.length > 0}
            label={
              conversions.length > 1
                ? `${conversions.length} conversões`
                : 'Conversão compra'
            }
          />
          <StatusPill active={Boolean(safe.microsoftClarityId)} label="Clarity" />
          <StatusPill
            active={overlap.gtmCount > 0}
            label={overlap.gtmCount > 0 ? `GTM (${overlap.gtmCount} tag)` : 'GTM'}
          />
        </div>

        {googleIds.length > 0 && (
          <p className="mt-3 text-xs text-text-muted">
            Loader injeta: {googleIds.map((id) => `config(${id})`).join(' · ')}
            {safe.microsoftClarityId ? ` · Clarity(${safe.microsoftClarityId})` : ''}
          </p>
        )}

        {(overlap.hasGa || overlap.hasClarity || overlap.hasAwConfig || overlap.hasConversionSnippet) && (
          <div className="mt-4 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Atenção: há tags HTML ativas que podem{' '}
            <strong>duplicar</strong> o que os Pixels já fazem
            {overlap.hasGa ? ' (GA4)' : ''}
            {overlap.hasAwConfig ? ' (Ads config)' : ''}
            {overlap.hasClarity ? ' (Clarity)' : ''}
            {overlap.hasConversionSnippet ? ' (snippet de conversão)' : ''}. Desative-as em “Tags e
            scripts”.
          </div>
        )}
      </Card>

      <Card title="Pixels Google / Clarity">
        <p className="mb-4 text-sm text-text-secondary">
          Preencha só o que usar. Campos vazios não carregam nada. IDs vêm do Google Ads / Analytics
          / Clarity — não use .env.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Google Tag (opcional · GT-… ou G-…)"
            value={safe.googleTagId ?? ''}
            onChange={(e) => patch({ googleTagId: e.target.value || null })}
            placeholder="GT-XXXXXXXX"
          />
          <Input
            label="Google Analytics 4 (G-…)"
            value={safe.googleAnalyticsId ?? ''}
            onChange={(e) => patch({ googleAnalyticsId: e.target.value || null })}
            placeholder="G-XXXXXXXX"
          />
          <Input
            label="Google Ads conta (AW-…) — pageview / remarketing"
            value={safe.googleAdsId ?? ''}
            onChange={(e) => patch({ googleAdsId: e.target.value || null })}
            placeholder="AW-XXXXXXXXXX"
            className="md:col-span-2"
          />
          <Input
            label="Microsoft Clarity (ID ou cole o snippet)"
            value={safe.microsoftClarityId ?? ''}
            onChange={(e) => patch({ microsoftClarityId: e.target.value || null })}
            placeholder="abcdefgh"
            className="md:col-span-2"
          />
        </div>
      </Card>

      <Card title="Conversões Google Ads (compra)">
        <p className="mb-4 text-sm text-text-secondary">
          Formato <code className="text-xs">AW-XXXXXXXXXX/rótulo</code> (copiado da ação de
          conversão no Google Ads). Dispara <strong>só com pagamento confirmado</strong>. Pode
          cadastrar 2+ ações (ex.: Compra + Compra assistida) — todas no mesmo pedido pago, 1× cada.
        </p>

        <ul className="space-y-3">
          {(conversions.length > 0 ? conversions : ['']).map((value, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2">
              <Input
                label={index === 0 ? 'Ação de conversão 1' : `Ação de conversão ${index + 1}`}
                value={value}
                onChange={(e) => updateConversion(index, e.target.value)}
                placeholder="AW-18248543414/n_0dCIfOhsEcELbZyv1D"
                className="min-w-[240px] flex-1"
              />
              {conversions.length > 1 && (
                <Button type="button" variant="secondary" onClick={() => removeConversion(index)}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>

        {conversions.length < MAX_ADS_CONVERSIONS && (
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={addConversion}>
              + Adicionar outra conversão Ads
            </Button>
          </div>
        )}
      </Card>

      <Card title="O que ainda posso adicionar?">
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>
            <strong className="text-text-primary">Nesta seção:</strong> Google Tag, GA4, Ads,
            Clarity, até {MAX_ADS_CONVERSIONS} conversões de compra.
          </li>
          <li>
            <strong className="text-text-primary">Em Tags e scripts (HTML):</strong> Google Tag
            Manager, Meta/Facebook Pixel, TikTok, scripts de chat, etc. — o que não tem campo acima.
          </li>
          <li>
            <strong className="text-text-primary">Não adicione de novo em HTML:</strong> GA4,
            Clarity, <code className="text-xs">gtag(&apos;config&apos;,&apos;AW-…&apos;)</code> nem
            snippet de Compra — isso já é coberto pelos Pixels.
          </li>
        </ul>
      </Card>
    </div>
  )
}
