import { z } from 'zod'
import { orderStatusSchema } from '@/schemas/order-schema'

export const trackingLookupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(8, 'Informe o código de rastreio')
    .max(32, 'Código inválido'),
})

export const adminTrackingActionSchema = z.discriminatedUnion('action', [
  z.object({
    orderId: z.string().uuid(),
    action: z.literal('dispatch'),
  }),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal('advance'),
  }),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal('pause'),
  }),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal('resume'),
  }),
  z.object({
    orderId: z.string().uuid(),
    action: z.literal('set_location'),
    city: z.string().trim().min(2).max(100),
    state: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().length(2)),
    message: z.string().trim().max(240).optional(),
  }),
])

export const orderStatusUpdateWithTrackingSchema = z.object({
  id: z.string().uuid(),
  status: orderStatusSchema,
})
