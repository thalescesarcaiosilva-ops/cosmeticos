import Image from 'next/image'
import type { CollectionDetail } from '@/types/collection'

type CollectionBannerProps = {
  collection: CollectionDetail
}

export function CollectionBanner({ collection }: CollectionBannerProps) {
  if (!collection.bannerImageUrl) return null

  return (
    <div className="mb-8 w-full">
      <Image
        src={collection.bannerImageUrl}
        alt={collection.pageTitle}
        width={0}
        height={0}
        sizes="100vw"
        priority
        className="h-auto w-full rounded-xl"
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  )
}
