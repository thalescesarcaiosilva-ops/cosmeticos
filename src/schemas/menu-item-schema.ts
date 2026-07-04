import { z } from 'zod'

export const createMenuItemSchema = z.object({
  label: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  href: z.string().min(1).max(200),
  parent_id: z.string().uuid().optional().nullable(),
  has_dropdown: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  visible: z.boolean().optional(),
})

export const updateMenuItemSchema = createMenuItemSchema.partial()

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>
