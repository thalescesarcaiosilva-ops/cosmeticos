import { z } from 'zod'

export const apiErrorSchema = z.object({
  error: z.literal(true),
  message: z.string(),
  code: z.string().optional(),
})

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
  })
