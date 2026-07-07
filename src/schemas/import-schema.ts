import { z } from 'zod'

const wooProductRowSchema = z.object({
  wooId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  gtin: z.string().max(14).nullable().optional(),
  price: z.number().positive(),
  originalPrice: z.number().positive().nullable().optional(),
  stock: z.number().int().min(0),
  active: z.boolean(),
  brandName: z.string().max(120).nullable().optional(),
  categoryNames: z.array(z.string().max(100)),
  images: z.array(
    z.object({
      url: z.string().url(),
      alt: z.string(),
    })
  ),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  productType: z.enum(['simple', 'variable']).default('simple'),
  variationCount: z.number().int().min(0).default(0),
})

export const importBatchSchema = z.object({
  rows: z.array(wooProductRowSchema).min(1).max(10),
  updateImages: z.boolean().optional(),
})

export type ImportBatchInput = z.infer<typeof importBatchSchema>
