import { z } from 'zod'

export const createFooterMenuSchema = z.object({
  title: z.string().trim().min(1).max(100),
  sort_order: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
})

export const updateFooterMenuSchema = createFooterMenuSchema.partial()

export const createFooterMenuItemSchema = z.object({
  menu_id: z.string().uuid(),
  label: z.string().trim().min(1).max(150),
  href: z.string().trim().min(1).max(300),
  sort_order: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
})

export const updateFooterMenuItemSchema = createFooterMenuItemSchema
  .omit({ menu_id: true })
  .partial()
  .extend({
    menu_id: z.string().uuid().optional(),
  })

export type CreateFooterMenuInput = z.infer<typeof createFooterMenuSchema>
export type UpdateFooterMenuInput = z.infer<typeof updateFooterMenuSchema>
export type CreateFooterMenuItemInput = z.infer<typeof createFooterMenuItemSchema>
export type UpdateFooterMenuItemInput = z.infer<typeof updateFooterMenuItemSchema>
