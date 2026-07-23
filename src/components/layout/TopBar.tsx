'use client'

import Link from 'next/link'
import { IconPhone } from '@/components/icons/DotIcons'
import type { PhoneContact, PolicyLink, SocialLink } from '@/types/layout'
import { SocialIcon } from './SocialIcon'

type TopBarProps = {
  storeName: string
  policyLinks: PolicyLink[]
  socialLinks: SocialLink[]
  phone?: PhoneContact
  overlay?: boolean
}

export function TopBar({
  storeName,
  policyLinks,
  socialLinks,
  phone,
  overlay = false,
}: TopBarProps) {
  const hasPhone = Boolean(phone?.display.trim() && phone?.href.trim())

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

          {hasPhone && phone && (
            <a
              href={phone.href}
              className={`flex size-7 items-center justify-center rounded-full transition-opacity duration-[400ms] hover:opacity-90 ${
                overlay ? 'bg-white/15 text-white' : 'bg-white/15 text-white'
              }`}
              aria-label={`Telefone ${phone.display}`}
              title={phone.display}
            >
              <IconPhone className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
