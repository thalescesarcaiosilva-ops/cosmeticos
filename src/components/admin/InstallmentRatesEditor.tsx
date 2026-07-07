'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type InstallmentRatesEditorProps = {
  maxInstallments: number
  interestFreeInstallments: number
  defaultRate: number
  rates: Record<number, number>
  onChange: (rates: Record<number, number>) => void
}

export function InstallmentRatesEditor({
  maxInstallments,
  interestFreeInstallments,
  defaultRate,
  rates,
  onChange,
}: InstallmentRatesEditorProps) {
  const chargeableCounts = Array.from(
    { length: Math.max(0, maxInstallments - interestFreeInstallments) },
    (_, i) => interestFreeInstallments + 1 + i
  )

  function setRate(count: number, value: string) {
    const parsed = parseFloat(value)
    const next = { ...rates }
    if (Number.isNaN(parsed) || parsed <= 0) {
      delete next[count]
    } else {
      next[count] = Math.round(parsed * 100) / 100
    }
    onChange(next)
  }

  if (chargeableCounts.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Todas as parcelas estão configuradas como sem juros.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Defina taxas mensais específicas por parcela. Parcelas não listadas usam a taxa padrão (
        {defaultRate}%).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chargeableCounts.map((count) => (
          <Input
            key={count}
            label={`${count}x — taxa mensal (%)`}
            type="number"
            step="0.01"
            min={0}
            placeholder={String(defaultRate)}
            value={rates[count] != null ? String(rates[count]) : ''}
            onChange={(e) => setRate(count, e.target.value)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange({})}
        className="text-sm"
      >
        Limpar taxas personalizadas
      </Button>
    </div>
  )
}

type SupportTopicsEditorProps = {
  topics: Array<{ title: string; description: string }>
  onChange: (topics: Array<{ title: string; description: string }>) => void
}

export function SupportTopicsEditor({ topics, onChange }: SupportTopicsEditorProps) {
  function updateTopic(index: number, field: 'title' | 'description', value: string) {
    const next = topics.map((topic, i) => (i === index ? { ...topic, [field]: value } : topic))
    onChange(next)
  }

  function addTopic() {
    onChange([...topics, { title: '', description: '' }])
  }

  function removeTopic(index: number) {
    onChange(topics.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Cards exibidos na página de contato como tópicos de suporte.
      </p>
      {topics.map((topic, index) => (
        <div key={index} className="rounded-lg border border-border bg-surface-muted p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">Tópico {index + 1}</p>
            <Button type="button" variant="secondary" onClick={() => removeTopic(index)}>
              Remover
            </Button>
          </div>
          <Input
            label="Título"
            value={topic.title}
            onChange={(e) => updateTopic(index, 'title', e.target.value)}
            maxLength={80}
          />
          <Textarea
            label="Descrição"
            value={topic.description}
            onChange={(e) => updateTopic(index, 'description', e.target.value)}
            rows={2}
            maxLength={300}
          />
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addTopic}>
        Adicionar tópico
      </Button>
    </div>
  )
}
