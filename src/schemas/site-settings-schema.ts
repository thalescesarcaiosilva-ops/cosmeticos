import { z } from 'zod'

const optionalUrl = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.union([z.string().url().max(500), z.null()]).optional())

const paymentMethodImageUrl = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === '') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })

const paymentMethodConfigSchema = z.object({
  id: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(80),
  imageUrl: paymentMethodImageUrl,
})

const paymentCheckoutConfigSchema = z.object({
  pixEnabled: z.boolean().optional(),
  pixDiscount: z.number().min(0).max(100).optional(),
  cardEnabled: z.boolean().optional(),
})

const installmentInterestRatesSchema = z
  .record(z.string(), z.number().min(0).max(100))
  .optional()

const contactSupportTopicSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(300),
})

export const updateSiteSettingsSchema = z.object({
  store_name: z.string().min(1).max(100).optional(),
  logo_image_url: optionalUrl,
  phone_area_code: z.string().max(10).optional(),
  phone_number: z.string().max(20).optional(),
  phone_href: z.string().max(30).optional(),
  help_label: z.string().max(50).optional(),
  help_href: z.string().max(200).optional(),
  seo_title: z.string().min(1).max(100).optional(),
  seo_title_template: z.string().min(1).max(100).optional(),
  seo_description: z
    .string()
    .max(300)
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null || value.trim() === '') return null
      return value.trim()
    }),
  seo_og_image_url: optionalUrl,
  favicon_url: optionalUrl,
  installment_max: z.number().int().min(1).max(24).optional(),
  installment_interest_free: z.number().int().min(1).max(24).optional(),
  installment_min_value: z.number().positive().max(99999).optional(),
  installment_interest_rate: z.number().min(0).max(100).optional(),
  installment_interest_rates: installmentInterestRatesSchema,
  installment_text_free: z.string().min(1).max(120).optional(),
  installment_text_interest: z.string().min(1).max(120).optional(),
  contact_page_title: z.string().min(1).max(100).optional(),
  contact_page_intro: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null || value.trim() === '') return null
      return value.trim()
    }),
  contact_page_support_topics: z.array(contactSupportTopicSchema).max(12).optional(),
  payment_methods_config: z.array(paymentMethodConfigSchema).max(20).optional(),
  payment_checkout_config: paymentCheckoutConfigSchema.optional(),
})

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>
