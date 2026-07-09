import Image from 'next/image'
import Link from 'next/link'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { SocialIcon } from '@/components/layout/SocialIcon'
import { PaymentMethodsImage } from '@/components/payment/PaymentMethodsImage'
import { hasPaymentMethodsImage } from '@/lib/payment/payment-methods-image'
import type { FooterData } from '@/lib/layout/get-footer-data'

type FooterProps = {
  className?: string
  footerData: FooterData
}

function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

function FooterMenuLink({ label, href }: { label: string; href: string }) {
  const className = 'text-text-secondary transition-colors hover:text-brand'

  if (isInternalHref(href)) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  )
}

function FooterAssetImage({
  imageUrl,
  alt,
  href,
  size = 'default',
}: {
  imageUrl: string
  alt: string
  href: string | null
  size?: 'default' | 'payment'
}) {
  const dimensions =
    size === 'payment'
      ? { width: 56, height: 36, className: 'h-9 w-14 object-contain' }
      : { width: 96, height: 40, className: 'h-10 w-auto max-w-[120px] object-contain' }

  const img = (
    <Image
      src={imageUrl}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      className={dimensions.className}
    />
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex">
        {img}
      </a>
    )
  }

  return img
}

function FooterBrandColumn({
  brand,
  socialLinks,
}: {
  brand: NonNullable<FooterData['brand']>
  socialLinks: FooterData['socialLinks']
}) {
  return (
    <div className="space-y-4">
      {brand.logoUrl && (
        <Link href="/" className="inline-block">
          <Image
            src={brand.logoUrl}
            alt={brand.storeName}
            width={160}
            height={48}
            className="h-12 w-auto max-w-[180px] object-contain"
          />
        </Link>
      )}
      {brand.description && (
        <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{brand.description}</p>
      )}
      {socialLinks.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {socialLinks.map((social) => (
            <a
              key={social.type}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-10 items-center justify-center rounded-full bg-logo text-white transition-opacity hover:opacity-90"
              aria-label={social.label}
            >
              <SocialIcon type={social.type} className="size-5" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function FooterMenusSection({ menus }: { menus: FooterData['menus'] }) {
  const visibleMenus = menus.filter((menu) => menu.items.length > 0)
  if (visibleMenus.length === 0) return null

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
      {visibleMenus.map((menu) => (
        <div key={menu.id}>
          <h3 className="mb-4 text-sm font-semibold text-text-primary">{menu.title}</h3>
          <ul className="space-y-2 text-sm">
            {menu.items.map((item) => (
              <li key={item.id}>
                <FooterMenuLink label={item.label} href={item.href} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function FooterContactColumn({ contact }: { contact: FooterData['contact'] }) {
  const hasContact =
    Boolean(contact.address) ||
    Boolean(contact.phoneDisplay) ||
    Boolean(contact.email) ||
    Boolean(contact.businessHours)

  if (!hasContact) return null

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Contato</h3>
      <div className="space-y-4 text-sm">
        {contact.address && (
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <p className="leading-relaxed text-text-secondary">
              {contact.address}
            </p>
          </div>
        )}
        {contact.phoneDisplay && (
          <div className="flex items-center gap-3">
            <Phone className="size-4 shrink-0 text-brand" aria-hidden />
            {contact.phoneHref ? (
              <a href={contact.phoneHref} className="font-semibold text-brand hover:opacity-90">
                {contact.phoneDisplay}
              </a>
            ) : (
              <span className="font-semibold text-brand">{contact.phoneDisplay}</span>
            )}
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-3">
            <Mail className="size-4 shrink-0 text-brand" aria-hidden />
            <a href={`mailto:${contact.email}`} className="text-text-secondary hover:text-brand">
              {contact.email}
            </a>
          </div>
        )}
        {contact.businessHours && (
          <div className="flex gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <p className="leading-relaxed text-text-secondary">
              <span className="font-semibold text-text-primary">Horário de atendimento:</span>{' '}
              {contact.businessHours}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FooterTrustStrip({ footerData }: { footerData: FooterData }) {
  const { legal } = footerData
  const showSecurity =
    footerData.securityAssets.length > 0 || Boolean(legal.securityText)
  const showPayment =
    hasPaymentMethodsImage() || Boolean(footerData.paymentText)

  if (!showSecurity && !showPayment) return null

  return (
    <div className="mt-10 border-t border-border pt-10">
      <div className="grid gap-10 md:grid-cols-2 md:gap-8">
        {showSecurity && (
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-logo">
              {footerData.securityHeading}
            </h3>
            {legal.securityText && (
              <p className="mb-4 text-xs leading-relaxed text-text-secondary">
                {legal.securityText}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              {footerData.securityAssets.map((asset) => (
                <FooterAssetImage
                  key={asset.id}
                  imageUrl={asset.image_url}
                  alt={asset.alt_text ?? 'Selo de segurança'}
                  href={asset.href}
                />
              ))}
            </div>
          </div>
        )}

        {showPayment && (
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-logo">
              {footerData.paymentHeading}
            </h3>
            {footerData.paymentText && (
              <p className="mb-4 text-xs text-text-secondary">{footerData.paymentText}</p>
            )}
            {hasPaymentMethodsImage() && <PaymentMethodsImage size="sm" />}
          </div>
        )}
      </div>
    </div>
  )
}

export function Footer({ className, footerData }: FooterProps) {
  const year = new Date().getFullYear()
  const { contact, legal, brand, menus, socialLinks } = footerData

  const showBrand =
    Boolean(brand?.logoUrl || brand?.description) || socialLinks.length > 0
  const brandData = brand ?? {
    logoUrl: null,
    storeName: legal.storeName,
    description: null,
  }
  const showMenus = menus.some((menu) => menu.items.length > 0)
  const showContact =
    Boolean(contact.address) ||
    Boolean(contact.phoneDisplay) ||
    Boolean(contact.email) ||
    Boolean(contact.businessHours)

  const copyrightParts = [
    `© ${year} Todos os direitos reservados`,
    legal.companyLegalName,
    legal.cnpj ? `CNPJ: ${legal.cnpj}` : null,
  ].filter(Boolean)

  return (
    <footer className={`mt-auto border-t border-border bg-surface text-text-secondary ${className ?? ''}`}>
      <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-12">
        {(showBrand || showMenus || showContact) && (
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
            {showBrand && (
              <div className="w-full lg:w-64 lg:shrink-0">
                <FooterBrandColumn brand={brandData} socialLinks={socialLinks} />
              </div>
            )}

            {showMenus && (
              <div className="flex-1">
                <FooterMenusSection menus={menus} />
              </div>
            )}

            {showContact && (
              <div className="w-full lg:w-72 lg:shrink-0">
                <FooterContactColumn contact={contact} />
              </div>
            )}
          </div>
        )}

        <FooterTrustStrip footerData={footerData} />

        <div className="mt-10 space-y-3 border-t border-border pt-8 text-center text-xs leading-relaxed text-text-muted">
          <p>{copyrightParts.join(' • ')}</p>
          {legal.disclaimers.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </footer>
  )
}
