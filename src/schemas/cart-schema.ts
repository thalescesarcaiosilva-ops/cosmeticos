import { z } from 'zod'

export const cartSyncSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .max(50),
})

export type CartSyncInput = z.infer<typeof cartSyncSchema>
