import { z } from 'zod'
import { mediaUrlSchema } from '@/lib/media/url-schema'

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido')

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  image_url: mediaUrlSchema,
  banner_image_url: mediaUrlSchema,
  page_title: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export const collectionSortSchema = z.enum([
  'relevance',
  'price_asc',
  'price_desc',
  'name_asc',
  'name_desc',
  'newest',
  'discount',
])

export const collectionFiltersSchema = z.object({
  sort: collectionSortSchema.optional().default('relevance'),
  min_price: z.coerce.number().min(0).max(999999).optional(),
  max_price: z.coerce.number().min(0).max(999999).optional(),
  brands: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : [])),
  categories: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : [])),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type CollectionSort = z.infer<typeof collectionSortSchema>
export type CollectionFiltersInput = z.infer<typeof collectionFiltersSchema>
