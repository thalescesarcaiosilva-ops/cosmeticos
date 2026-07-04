import { z } from 'zod'

export const createSocialLinkSchema = z.object({
  type: z.enum(['whatsapp', 'facebook', 'instagram']),
  href: z.string().min(1).max(300),
  label: z.string().min(1).max(50),
  display: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
})

export const updateSocialLinkSchema = createSocialLinkSchema.partial()

export type CreateSocialLinkInput = z.infer<typeof createSocialLinkSchema>
export type UpdateSocialLinkInput = z.infer<typeof updateSocialLinkSchema>
