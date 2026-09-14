import { SiteImage } from '@/components/ui/SiteImage'
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
        <SiteImage
          src={logo.imageUrl}
          alt={storeName}
          width={160}
          height={48}
          sizes="(max-width: 767px) 96px, 120px"
          priority
          bypassOptimizer={false}
          className={`h-12 w-[96px] max-w-[96px] object-contain object-left md:w-[120px] md:max-w-[120px] ${
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
