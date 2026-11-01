'use client'

import { toPublicHref } from '@/lib/navigation/public-href'
import { FREE_SHIPPING_LABEL } from '@/lib/shipping/merchant-shipping'
import type { PolicyLink, SocialLink } from '@/types/layout'
import { SocialIcon } from './SocialIcon'

type TopBarProps = {
  storeName: string
  policyLinks: PolicyLink[]
  socialLinks: SocialLink[]
}

function CampaignCluster() {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 sm:gap-3 md:justify-end">
      <span className="inline-flex items-center rounded-full bg-brand px-3 py-1 text-[10px] font-bold tracking-[0.08em] text-white sm:px-3.5 sm:text-[11px]">
        PRÉ BLACK FRIDAY
      </span>
      <p className="text-center text-[11px] font-semibold text-white sm:whitespace-nowrap sm:text-[12px]">
        {FREE_SHIPPING_LABEL}
      </p>
    </div>
  )
}

export function TopBar({ storeName, policyLinks, socialLinks }: TopBarProps) {
  return (
    <div className="bg-black text-[11px] font-semibold text-white">
      <div className="mx-auto flex max-w-[1300px] items-center justify-center gap-3 px-4 py-2.5 md:justify-between md:px-6">
        <div className="hidden min-w-0 items-center gap-2 overflow-hidden md:flex">
          {storeName.trim() && (
            <span className="hidden shrink-0 text-white/90 lg:inline">
              Conheça mais sobre a {storeName}:
            </span>
          )}
          <nav
            className="flex min-w-0 items-center overflow-x-auto whitespace-nowrap"
            aria-label="Links institucionais"
          >
            {policyLinks.map((link, index) => (
              <span key={link.href} className="flex shrink-0 items-center">
                {index > 0 ? (
                  <span className="px-1.5 text-white/45" aria-hidden>
                    ·
                  </span>
                ) : null}
                <a
                  href={toPublicHref(link.href)}
                  className="text-white/90 transition-colors duration-200 hover:text-white"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 md:shrink-0 md:justify-end">
          {socialLinks.length > 0 ? (
            <div className="hidden items-center gap-2 xl:flex">
              {socialLinks.map((social) => (
                <a
                  key={social.type}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-6 items-center justify-center rounded-full text-white/80 transition-colors duration-200 hover:text-white"
                  aria-label={social.label}
                >
                  <SocialIcon type={social.type} className="size-3.5" />
                </a>
              ))}
            </div>
          ) : null}
          <CampaignCluster />
        </div>
      </div>
    </div>
  )
}
