import { z } from 'zod'

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo').max(200),
  email: z.string().trim().email('E-mail inválido').max(200),
  phone: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === '' ? null : v.trim())),
  subject: z.string().trim().min(3, 'Informe o assunto').max(200),
  message: z.string().trim().min(10, 'Escreva uma mensagem com pelo menos 10 caracteres').max(5000),
  website: z.string().optional(),
})

export type ContactFormInput = z.infer<typeof contactFormSchema>

export const contactMessageStatusSchema = z.enum(['new', 'read', 'archived'])

export const contactMessageStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: contactMessageStatusSchema,
})
