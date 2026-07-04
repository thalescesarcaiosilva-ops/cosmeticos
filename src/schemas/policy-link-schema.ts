import { z } from 'zod'

export const createPolicyLinkSchema = z.object({
  label: z.string().min(1).max(100),
  href: z.string().min(1).max(200),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
})

export const updatePolicyLinkSchema = createPolicyLinkSchema.partial()

export type CreatePolicyLinkInput = z.infer<typeof createPolicyLinkSchema>
export type UpdatePolicyLinkInput = z.infer<typeof updatePolicyLinkSchema>
