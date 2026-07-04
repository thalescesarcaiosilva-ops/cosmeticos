import { z } from 'zod'
import { cartSyncSchema } from '@/schemas/cart-schema'

export const checkoutSchema = z.object({
  address_id: z.string().uuid(),
  shipping_method_id: z.string().uuid(),
  items: cartSyncSchema.shape.items,
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
