import { z } from 'zod'

function normalizeZipCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export const createAddressSchema = z.object({
  label: z.string().max(50).optional(),
  street: z.string().trim().min(1, 'Informe a rua').max(200),
  number: z.string().trim().min(1, 'Informe o número').max(10),
  complement: z.string().trim().max(100).optional().nullable(),
  neighborhood: z.string().trim().min(1, 'Informe o bairro').max(100),
  city: z.string().trim().min(1, 'Informe a cidade').max(100),
  state: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().length(2, 'UF inválida')),
  zip_code: z
    .string()
    .transform(normalizeZipCode)
    .refine((v) => v.length === 8, 'CEP deve ter 8 dígitos'),
  is_default: z.boolean().optional(),
})

export const updateAddressSchema = createAddressSchema.partial()

export type CreateAddressInput = z.infer<typeof createAddressSchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>
