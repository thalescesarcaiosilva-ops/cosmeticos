import { z } from 'zod'

const linkSchema = z
  .string()
  .max(500)
  .refine(
    (val) => !val || val.startsWith('/') || val.startsWith('http://') || val.startsWith('https://'),
    'Link deve ser relativo (/pagina) ou URL completa'
  )

export const bannerDeviceTargetSchema = z.enum(['both', 'desktop', 'mobile'])

export const createBannerSchema = z.object({
  title: z.string().max(120).optional(),
  alt_text: z.string().max(255).optional().nullable(),
  link_href: linkSchema.optional().nullable(),
  active: z.boolean().optional(),
  device_target: bannerDeviceTargetSchema.optional().default('both'),
})

export const updateBannerSchema = createBannerSchema.extend({
  sort_order: z.number().int().min(0).optional(),
})

export type BannerDeviceTarget = z.infer<typeof bannerDeviceTargetSchema>
export type CreateBannerInput = z.infer<typeof createBannerSchema>
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>
