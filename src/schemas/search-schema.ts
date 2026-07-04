import { z } from 'zod'

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Digite ao menos 2 caracteres')
    .max(100),
})

export type SearchQueryInput = z.infer<typeof searchQuerySchema>
