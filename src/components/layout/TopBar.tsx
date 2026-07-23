'use client'

import Link from 'next/link'
import { IconCart } from '@/components/icons/DotIcons'
import { useCart } from '@/providers/CartProvider'
import type { PolicyLink, SocialLink } from '@/types/layout'
import { SocialIcon } from './SocialIcon'

type TopBarProps = {
  storeName: string
  policyLinks: PolicyLink[]
  socialLinks: SocialLink[]
  overlay?: boolean
}

export function TopBar({ storeName, policyLinks, socialLinks, overlay = false }: TopBarProps) {
  const { itemCount: cartItemCount, hydrated } = useCart()

  return (
    <div
      className={`border-b text-[12px] font-bold transition-colors duration-[400ms] ${
        overlay
          ? 'border-white/10 bg-transparent text-white/90'
          : 'border-border/70 bg-brand text-white'
      }`}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden md:gap-2">
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
                className={`shrink-0 transition-opacity duration-[400ms] hover:opacity-80 ${
                  overlay ? 'text-white/90 hover:text-white' : 'hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 md:gap-3">
          {socialLinks.map((social) => (
            <a
              key={social.type}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex size-7 items-center justify-center rounded-full transition-opacity duration-[400ms] hover:opacity-90 ${
                overlay ? 'bg-white/15 text-white' : 'bg-brand text-white'
              }`}
              aria-label={social.label}
            >
              <SocialIcon type={social.type} className="size-3.5" />
            </a>
          ))}

          <Link
            href="/carrinho"
            className={`relative flex size-7 items-center justify-center rounded-full transition-opacity duration-[400ms] hover:opacity-90 ${
              overlay ? 'bg-white/15 text-white' : 'bg-white/15 text-white'
            }`}
            title="Meu Carrinho"
            aria-label={`Meu Carrinho${cartItemCount > 0 ? `, ${cartItemCount} itens` : ''}`}
          >
            <IconCart className="size-3.5" />
            {hydrated && cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold text-brand">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
