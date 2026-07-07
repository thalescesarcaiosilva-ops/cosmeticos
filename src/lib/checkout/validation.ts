import { createAddressSchema } from '@/schemas/address-schema'
import { checkoutCustomerSchema } from '@/schemas/checkout-payment-schema'
import { z } from 'zod'

export type FieldErrors<T extends string> = Partial<Record<T, string>>

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCepInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function formatPhoneInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatCpfInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

const cpfDigitsSchema = z
  .string()
  .transform((v) => onlyDigits(v))
  .refine((v) => v.length === 11, 'Informe um CPF com 11 dígitos')

export function validateCheckoutIdentification(input: {
  name: string
  email: string
  phone: string
}): { ok: true; data: z.infer<typeof checkoutCustomerSchema> } | { ok: false; errors: FieldErrors<'name' | 'email' | 'phone'> } {
  const parsed = checkoutCustomerSchema.safeParse({
    name: input.name,
    email: input.email,
    phone: input.phone,
  })

  if (parsed.success) return { ok: true, data: parsed.data }

  const errors: FieldErrors<'name' | 'email' | 'phone'> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (key === 'name' || key === 'email' || key === 'phone') {
      if (!errors[key]) errors[key] = issue.message
    }
  }
  return { ok: false, errors }
}

export function validateCheckoutAddress(input: {
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zip_code: string
}): { ok: true; data: z.infer<typeof createAddressSchema> } | { ok: false; errors: FieldErrors<keyof typeof input>; message: string } {
  const parsed = createAddressSchema.safeParse({
    street: input.street.trim(),
    number: input.number.trim(),
    complement: input.complement.trim() || null,
    neighborhood: input.neighborhood.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zip_code: input.zip_code,
  })

  if (parsed.success) return { ok: true, data: parsed.data }

  const errors: FieldErrors<keyof typeof input> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && key in input && !errors[key as keyof typeof input]) {
      errors[key as keyof typeof input] = issue.message
    }
  }

  const first = parsed.error.issues[0]?.message ?? 'Preencha todos os campos do endereço corretamente'
  return { ok: false, errors, message: first }
}

export function validateCheckoutCpf(cpf: string): { ok: true; document: string } | { ok: false; message: string } {
  const parsed = cpfDigitsSchema.safeParse(cpf)
  if (parsed.success) return { ok: true, document: parsed.data }
  return { ok: false, message: parsed.error.issues[0]?.message ?? 'CPF inválido' }
}

export function mapCheckoutApiError(error: string | null, message?: string | null): string {
  if (!error && !message) return 'Não foi possível concluir o pagamento. Tente novamente.'

  const code = (error ?? '').toUpperCase()
  const map: Record<string, string> = {
    EMPTY_CART: 'Seu carrinho está vazio ou expirou.',
    INSUFFICIENT_STOCK: 'Um ou mais produtos não têm estoque suficiente.',
    ADDRESS_NOT_FOUND: 'Endereço inválido. Revise os dados de entrega.',
    INVALID_CEP: 'CEP inválido. Informe 8 dígitos.',
    SHIPPING_NOT_FOUND: 'Frete indisponível para este CEP.',
    PROFILE_INCOMPLETE: 'Complete seus dados de identificação.',
    PIX_DISABLED: 'Pagamento via Pix está temporariamente indisponível.',
    CARD_DISABLED: 'Pagamento com cartão está temporariamente indisponível.',
    CARD_REFUSED: 'Cartão recusado. Verifique os dados ou use outro cartão.',
    PAYOUT_ERROR: 'Erro no processamento do pagamento. Tente novamente em instantes.',
    VALIDATION_ERROR: message ?? 'Verifique os dados informados.',
  }

  return map[code] ?? message ?? error ?? 'Erro inesperado. Tente novamente.'
}
