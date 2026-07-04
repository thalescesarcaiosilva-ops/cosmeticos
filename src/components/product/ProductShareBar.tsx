'use client'

import { useEffect, useState } from 'react'
import { SocialIcon } from '@/components/layout/SocialIcon'
import type { SocialLink } from '@/types/layout'

type ProductShareBarProps = {
  productName: string
  socialLinks: SocialLink[]
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.062 2.062 0 114.126 0 2.062 2.062 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export function ProductShareBar({ productName, socialLinks }: ProductShareBarProps) {
  const [pageUrl, setPageUrl] = useState('')

  useEffect(() => {
    setPageUrl(window.location.href)
  }, [])

  const shareText = encodeURIComponent(productName)
  const shareUrl = encodeURIComponent(pageUrl)

  const whatsapp = socialLinks.find((s) => s.type === 'whatsapp')
  const instagram = socialLinks.find((s) => s.type === 'instagram')

  const shareItems = [
    {
      key: 'whatsapp',
      label: 'Compartilhar no WhatsApp',
      href: pageUrl
        ? `https://wa.me/?text=${shareText}%20${shareUrl}`
        : whatsapp?.href,
      icon: <SocialIcon type="whatsapp" className="size-4" />,
    },
    {
      key: 'facebook',
      label: 'Compartilhar no Facebook',
      href: pageUrl ? `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}` : undefined,
      icon: <SocialIcon type="facebook" className="size-4" />,
    },
    {
      key: 'instagram',
      label: 'Instagram da loja',
      href: instagram?.href,
      icon: <SocialIcon type="instagram" className="size-4" />,
    },
    {
      key: 'linkedin',
      label: 'Compartilhar no LinkedIn',
      href: pageUrl
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`
        : undefined,
      icon: <LinkedInIcon className="size-4" />,
    },
  ].filter((item) => item.href)

  if (shareItems.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-text-secondary">Compartilhar</span>
      <div className="flex gap-2">
        {shareItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-8 items-center justify-center rounded-full bg-logo text-white transition-opacity hover:opacity-90"
            aria-label={item.label}
          >
            {item.icon}
          </a>
        ))}
      </div>
    </div>
  )
}
