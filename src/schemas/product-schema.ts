import { z } from 'zod'
import { DEFAULT_PRODUCT_STOCK } from '@/lib/products/stock'

const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido')

export const brandSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(120),
  slug: slugSchema,
  active: z.boolean().optional(),
})

export const createBrandSchema = brandSchema
export const updateBrandSchema = brandSchema.partial()

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200),
  slug: slugSchema,
  description: z.string().max(5000).optional().nullable(),
  price: z.number().positive('Preço deve ser maior que zero').max(999999.99),
  original_price: z.number().positive().max(999999.99).optional().nullable(),
  stock: z.number().int().min(0).default(DEFAULT_PRODUCT_STOCK),
  brand_id: z.string().uuid().optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  gtin: z.string().max(14).optional().nullable(),
  meta_title: z.string().max(70).optional().nullable(),
  meta_description: z.string().max(160).optional().nullable(),
  category_ids: z.array(z.string().uuid()).max(20).optional(),
  media_ids: z.array(z.string().uuid()).max(20).optional(),
  active: z.boolean().optional(),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
