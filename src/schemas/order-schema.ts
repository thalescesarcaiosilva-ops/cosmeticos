import { z } from 'zod'

export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
])

export const orderStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: orderStatusSchema,
})

export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>
