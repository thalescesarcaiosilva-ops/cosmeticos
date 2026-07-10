import { z } from 'zod'
import { isValidMediaUrl } from '@/lib/media/url-schema'

export const footerAssetTypeSchema = z.enum(['payment', 'security'])

export const createFooterAssetSchema = z.object({
  asset_type: footerAssetTypeSchema,
  image_url: z
    .string()
    .max(500)
    .refine(isValidMediaUrl, 'URL inválida'),
  alt_text: z.string().max(150).optional().nullable(),
  href: z.string().max(300).optional().nullable(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
})

export const updateFooterAssetSchema = createFooterAssetSchema.partial()

export type CreateFooterAssetInput = z.infer<typeof createFooterAssetSchema>
export type UpdateFooterAssetInput = z.infer<typeof updateFooterAssetSchema>
