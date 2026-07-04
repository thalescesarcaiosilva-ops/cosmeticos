import { z } from 'zod'

export const footerPageTypeSchema = z.enum(['institutional', 'policy', 'services', 'support'])

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido')

export const createFooterPageSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(150),
  content: z.string().max(50000).optional().nullable(),
  meta_description: z.string().max(300).optional().nullable(),
  active: z.boolean().optional(),
})

export const updateFooterPageSchema = createFooterPageSchema.partial()

export type CreateFooterPageInput = z.infer<typeof createFooterPageSchema>
export type UpdateFooterPageInput = z.infer<typeof updateFooterPageSchema>
