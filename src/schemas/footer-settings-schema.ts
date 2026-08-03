import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().nullable()

export const updateFooterSettingsSchema = z.object({
  cnpj: optionalText(20),
  company_legal_name: optionalText(200),
  footer_phone_label: optionalText(100),
  business_hours: optionalText(300),
  contact_whatsapp_label: optionalText(50),
  contact_whatsapp_href: optionalText(300),
  contact_page_label: optionalText(50),
  contact_page_href: optionalText(200),
  footer_social_heading: optionalText(80),
  footer_security_heading: optionalText(80),
  footer_payment_text: optionalText(200),
  footer_security_text: optionalText(500),
  footer_disclaimers: z.array(z.string().max(1000)).max(20).optional().nullable(),
  contact_email: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.union([z.string().email().max(200), z.null()]).optional()),
  contact_address: optionalText(500),
  contact_address_label: optionalText(100),
})

export type UpdateFooterSettingsInput = z.infer<typeof updateFooterSettingsSchema>
