import { CreditCard, Lock, ShieldCheck } from 'lucide-react'

const BADGES = [
  { icon: Lock, label: 'Conexão segura SSL' },
  { icon: ShieldCheck, label: 'Dados protegidos' },
  { icon: CreditCard, label: 'Pagamento criptografado' },
] as const

export function CheckoutSecurityBadges() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-6 border-t border-border pt-8 text-text-muted md:gap-10">
      {BADGES.map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-2 text-xs md:text-sm">
          <Icon className="size-4 shrink-0 text-brand/70" aria-hidden />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
