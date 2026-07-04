export type TrustBadge = {
  icon: string
  title: string
  subtitle?: string
  href?: string
}

export type Category = {
  id: string
  name: string
  slug: string
  imageUrl?: string | null
}

export type Product = {
  id: string
  slug: string
  name: string
  price: number
  originalPrice?: number | null
  images: string[]
  stock: number
  categoryId?: string | null
}
