import { z } from 'zod'

export const productVariationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nome da variação obrigatório').max(120),
  sku: z.string().max(50).nullable().optional(),
  price: z.number().positive('Preço da variação deve ser maior que zero').max(999999.99),
  stock: z.number().int().min(0),
  media_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export const upsertProductVariationsSchema = z.object({
  variations: z.array(productVariationInputSchema).max(100),
})

export type ProductVariationInput = z.infer<typeof productVariationInputSchema>
