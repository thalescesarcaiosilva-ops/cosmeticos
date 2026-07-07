import Link from 'next/link'
import type { StoreLogo } from '@/types/layout'

type StoreLogoProps = {
  logo: StoreLogo
  storeName: string
  className?: string
  variant?: 'light' | 'dark'
}

export function StoreLogoMark({
  logo,
  storeName,
  className,
  variant = 'dark',
}: StoreLogoProps) {
  if (logo.imageUrl) {
    return (
      <Link
        href="/"
        className={`inline-flex shrink-0 items-center ${className ?? ''}`}
        title={storeName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.imageUrl}
          alt={storeName}
          className={`w-auto max-w-[120px] object-contain transition-[filter,opacity] duration-[400ms]  ${
            variant === 'light' ? 'brightness-0 invert' : ''
          }`}
        />
      </Link>
    )
  }

  return (
    <Link
      href="/"
      className={`inline-flex shrink-0 items-center text-base font-bold tracking-tight transition-colors duration-[400ms] md:text-[21px] ${
        variant === 'light' ? 'text-white' : 'text-logo'
      } ${className ?? ''}`}
      title={storeName}
    >
      {storeName}
    </Link>
  )
}
