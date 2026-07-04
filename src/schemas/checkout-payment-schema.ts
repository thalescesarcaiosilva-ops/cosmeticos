import { z } from 'zod'
import { cartSyncSchema } from '@/schemas/cart-schema'
import { createAddressSchema } from '@/schemas/address-schema'

const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, 'CPF inválido')

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10 && v.length <= 11, 'Telefone inválido'),
})

export const checkoutShippingAddressSchema = createAddressSchema.omit({
  label: true,
  is_default: true,
})

export const checkoutBaseSchema = z.object({
  shipping_method_id: z.string().uuid(),
  items: cartSyncSchema.shape.items,
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
