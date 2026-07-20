import { BuyTogetherSettingsForm } from '@/components/admin/BuyTogetherSettingsForm'

export default function AdminBuyTogetherPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Compre junto</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Ative ou desative a oferta na página de produto e ajuste textos, limites e CSS.
        </p>
      </div>
      <BuyTogetherSettingsForm />
    </div>
  )
}
