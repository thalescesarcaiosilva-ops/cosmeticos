import { z } from 'zod'

const bundlePairSchema = z.object({
  primary_product_id: z.string().uuid(),
  companion_product_id: z.string().uuid(),
  discount_percent: z.number().min(0).max(100),
})

export const cartSyncSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .max(50),
  bundle_pairs: z.array(bundlePairSchema).max(20).optional(),
})

export type CartSyncInput = z.infer<typeof cartSyncSchema>
