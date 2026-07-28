'use client'

import Link from 'next/link'
import type { PolicyLink, SocialLink } from '@/types/layout'
import { SocialIcon } from './SocialIcon'

type TopBarProps = {
  storeName: string
  policyLinks: PolicyLink[]
  socialLinks: SocialLink[]
}

export function TopBar({ storeName, policyLinks, socialLinks }: TopBarProps) {
  return (
    <div className="bg-[#eeeeee] text-[11px] font-semibold text-[#302b2e]">
      <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-3 px-4 py-1 md:px-6">
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
                className="shrink-0 text-[#302b2e] transition-colors duration-200 hover:text-claret"
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
              className="flex size-7 items-center justify-center rounded-full text-[#302b2e] transition-colors duration-200 hover:text-claret"
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
