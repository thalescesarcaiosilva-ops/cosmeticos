import { z } from 'zod'
import { cartSyncSchema } from '@/schemas/cart-schema'
import { createAddressSchema } from '@/schemas/address-schema'

const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, 'CPF inválido')

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo').max(120, 'Nome muito longo'),
  email: z.string().trim().email('Informe um e-mail válido').max(200, 'E-mail muito longo'),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10 && v.length <= 11, 'Informe um celular com DDD (10 ou 11 dígitos)'),
})

export const checkoutShippingAddressSchema = createAddressSchema.omit({
  label: true,
  is_default: true,
})

export const checkoutBaseSchema = z.object({
  shipping_method_id: z.string().uuid(),
  items: cartSyncSchema.shape.items,
  bundle_pairs: cartSyncSchema.shape.bundle_pairs,
  document: cpfSchema,
  customer: checkoutCustomerSchema,
  shipping_address: checkoutShippingAddressSchema,
})

export const checkoutPixSchema = checkoutBaseSchema

export const checkoutCardSchema = checkoutBaseSchema.extend({
  card_hash: z.string().min(10).max(500),
  installments: z.number().int().min(1).max(24),
})

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>
export type CheckoutShippingAddressInput = z.infer<typeof checkoutShippingAddressSchema>
export type CheckoutPixInput = z.infer<typeof checkoutPixSchema>
export type CheckoutCardInput = z.infer<typeof checkoutCardSchema>
