import { z } from 'zod'

export const favoriteActionSchema = z.object({
  productId: z.string().uuid(),
  action: z.enum(['add', 'remove']),
})

export const favoriteSyncSchema = z.object({
  productIds: z.array(z.string().uuid()).max(100),
})

export const favoriteProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).max(100),
})
