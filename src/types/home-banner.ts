import type { BannerDeviceTarget } from '@/schemas/banner-schema'

export type HomeBanner = {
  id: string
  title: string
  alt_text: string | null
  link_href: string | null
  image_url: string
  storage_path: string
  width: number | null
  height: number | null
  file_size: number | null
  sort_order: number
  active: boolean
  device_target: BannerDeviceTarget
  created_at: string
}

export type HomeBannerPublic = Pick<
  HomeBanner,
  'id' | 'title' | 'alt_text' | 'link_href' | 'image_url' | 'width' | 'height' | 'device_target'
>
