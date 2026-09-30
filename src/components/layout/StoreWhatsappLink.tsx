import { Phone } from 'lucide-react'
import { SocialIcon } from '@/components/layout/SocialIcon'

/** Contato extra de WhatsApp. Não substitui o telefone oficial da loja. */
export const STORE_WHATSAPP_HREF = 'https://wa.me/5531975549608'
export const STORE_WHATSAPP_DISPLAY = '(31) 97554-9608'

type StoreWhatsappLinkProps = {
  className?: string
  iconClassName?: string
}

export function StoreWhatsappLink({
  className = 'inline-flex items-center gap-3 font-semibold text-brand hover:opacity-90',
  iconClassName = 'size-4 shrink-0',
}: StoreWhatsappLinkProps) {
  return (
    <a
      href={STORE_WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={`WhatsApp ${STORE_WHATSAPP_DISPLAY}`}
    >
      <SocialIcon type="whatsapp" className={iconClassName} />
      <span>{STORE_WHATSAPP_DISPLAY}</span>
    </a>
  )
}

type StoreContactCalloutProps = {
  phoneDisplay: string | null
  phoneHref: string | null
}

export function StoreContactCallout({ phoneDisplay, phoneHref }: StoreContactCalloutProps) {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-text-primary">Fale conosco</p>
      <StoreWhatsappLink iconClassName="size-5 shrink-0 text-brand" />
      {phoneDisplay && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Phone className="size-3.5 shrink-0" aria-hidden />
          {phoneHref ? (
            <a href={phoneHref} className="hover:text-text-secondary">
              {phoneDisplay}
            </a>
          ) : (
            <span>{phoneDisplay}</span>
          )}
        </div>
      )}
    </div>
  )
}
