import { z } from 'zod'

const cepRuleSchema = z.object({
  prefixes: z.array(z.string().min(1).max(5).regex(/^\d+$/)).min(1).max(20),
  price: z.number().min(0).max(99999),
  estimated_days_min: z.number().int().min(0).max(90).optional().nullable(),
  estimated_days_max: z.number().int().min(0).max(90).optional().nullable(),
  region_label: z.string().min(1).max(80).optional().nullable(),
})

export const shippingQuoteSchema = z.object({
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().length(8, 'CEP inválido')),
  subtotal: z.number().min(0).max(999999),
})

export const createShippingMethodSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  base_price: z.number().min(0).max(99999),
  free_above: z.number().min(0).max(999999).optional().nullable(),
  estimated_days_min: z.number().int().min(0).max(90).optional().nullable(),
  estimated_days_max: z.number().int().min(0).max(90).optional().nullable(),
  cep_rules: z.array(cepRuleSchema).max(30).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
})

export const updateShippingMethodSchema = createShippingMethodSchema.partial()

export type ShippingQuoteInput = z.infer<typeof shippingQuoteSchema>
export type CreateShippingMethodInput = z.infer<typeof createShippingMethodSchema>
