'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/products/format'
import type { PolicyLink, SocialLink } from '@/types/layout'
import { SocialIcon } from './SocialIcon'

type TopBarProps = {
  storeName: string
  policyLinks: PolicyLink[]
  socialLinks: SocialLink[]
  freeShippingAbove?: number | null
}

export function TopBar({
  storeName,
  policyLinks,
  socialLinks,
  freeShippingAbove = null,
}: TopBarProps) {
  const freeShippingLabel =
    freeShippingAbove == null
      ? null
      : freeShippingAbove <= 0
        ? 'Frete grátis'
        : `Frete grátis acima de ${formatCurrency(freeShippingAbove)}`

  return (
    <div className="bg-brand text-[11px] font-semibold text-white">
      {/* Mobile: frete no centro + redes à direita */}
      <div className="relative mx-auto flex max-w-[1300px] items-center justify-end px-4 py-1 md:hidden">
        <p className="absolute left-1/2 max-w-[70%] -translate-x-1/2 truncate text-center whitespace-nowrap">
          {freeShippingLabel ?? '\u00a0'}
        </p>
        <div className="relative z-10 flex shrink-0 items-center gap-2.5">
          {socialLinks.map((social) => (
            <a
              key={social.type}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-7 items-center justify-center rounded-full text-white transition-colors duration-200 hover:text-claret"
              aria-label={social.label}
            >
              <SocialIcon type={social.type} className="size-3.5" />
            </a>
          ))}
        </div>
      </div>

      {/* Desktop: conheça mais + políticas | frete | redes */}
      <div className="mx-auto hidden max-w-[1300px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-6 py-1 md:grid">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {storeName.trim() && (
            <span className="hidden shrink-0 lg:inline">
              Conheça mais sobre a {storeName}:
            </span>
          )}
          <nav
            className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap"
            aria-label="Links institucionais"
          >
            {policyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 text-white transition-colors duration-200 hover:text-claret"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="px-2 text-center whitespace-nowrap">
          {freeShippingLabel ?? '\u00a0'}
        </p>

        <div className="flex items-center justify-end gap-3">
          {socialLinks.map((social) => (
            <a
              key={social.type}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-7 items-center justify-center rounded-full text-white transition-colors duration-200 hover:text-claret"
              aria-label={social.label}
            >
              <SocialIcon type={social.type} className="size-3.5" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
