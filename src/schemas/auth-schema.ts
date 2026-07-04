import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido').max(255),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(128),
})

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128)
  .regex(/[A-Z]/, 'Precisa de letra maiúscula')
  .regex(/[0-9]/, 'Precisa de número')

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(100),
  email: z.string().email('E-mail inválido').max(255),
  password: passwordSchema,
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido').max(255),
})

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
