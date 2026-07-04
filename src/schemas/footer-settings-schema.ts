import { z } from 'zod'

export const updateFooterSettingsSchema = z.object({
  cnpj: z.string().max(20).optional().nullable(),
  company_legal_name: z.string().max(200).optional().nullable(),
  footer_phone_label: z.string().max(100).optional(),
  business_hours: z.string().max(300).optional().nullable(),
  contact_whatsapp_label: z.string().max(50).optional(),
  contact_whatsapp_href: z.string().max(300).optional().nullable(),
  contact_page_label: z.string().max(50).optional(),
  contact_page_href: z.string().max(200).optional(),
  footer_social_heading: z.string().max(80).optional(),
  footer_security_heading: z.string().max(80).optional(),
  footer_payment_text: z.string().max(200).optional(),
  footer_security_text: z.string().max(500).optional().nullable(),
  footer_disclaimers: z.array(z.string().max(1000)).max(20).optional(),
  contact_email: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.union([z.string().email().max(200), z.null()]).optional()),
  contact_address: z.string().max(500).optional().nullable(),
  contact_address_label: z.string().max(100).optional(),
})

export type UpdateFooterSettingsInput = z.infer<typeof updateFooterSettingsSchema>
