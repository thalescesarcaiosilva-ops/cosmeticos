import { z } from 'zod'

const cpfSchema = z
  .string()
  .max(14)
  .regex(/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, 'CPF inválido')

export const profileUpdateSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    cpf: cpfSchema.optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Nenhum campo para atualizar',
  })

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
