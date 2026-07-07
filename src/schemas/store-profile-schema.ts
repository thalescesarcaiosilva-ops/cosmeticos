import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === '' ? null : v.trim()))

const optionalEmail = z
  .string()
  .max(200)
  .optional()
  .nullable()
  .transform((v): string | null => {
    if (v == null || v.trim() === '') return null
    return v.trim().toLowerCase()
  })
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: 'E-mail inválido',
  })

const dayOfWeekSchema = z.union([
  z.enum([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]),
  z
    .array(
      z.enum([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ])
    )
    .min(1)
    .max(7),
])

export const storeOpeningHoursSlotSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  opens: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  closes: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
})

export const updateStoreProfileSchema = z.object({
  store_name: z.string().min(1).max(100).optional(),
  company_legal_name: optionalText(200),
  cnpj: optionalText(20),
  store_description: optionalText(2000),
  contact_email: optionalEmail,
  phone_area_code: z.string().max(10).optional(),
  phone_number: z.string().max(20).optional(),
  phone_href: z.string().max(30).optional(),
  store_street: optionalText(200),
  store_street_number: optionalText(20),
  store_complement: optionalText(100),
  store_neighborhood: optionalText(100),
  store_city: optionalText(100),
  store_state: z
    .string()
    .max(2)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === '' ? null : v.trim().toUpperCase())),
  store_postal_code: optionalText(10),
  store_country: z.string().length(2).optional(),
  store_opening_hours: z.array(storeOpeningHoursSlotSchema).max(14).optional(),
  return_enabled: z.boolean().optional(),
  return_days: z.number().int().min(1).max(365).optional().nullable(),
  return_method: z.enum(['ReturnByMail', 'ReturnInStore']).optional(),
  return_fees: z.enum(['FreeReturn', 'ReturnShippingFees', 'RestockingFees']).optional(),
  return_policy_page_slug: optionalText(100),
  return_policy_notes: optionalText(2000),
  seo_handling_days_min: z.number().int().min(0).max(30).optional(),
  seo_handling_days_max: z.number().int().min(0).max(30).optional(),
  head_scripts: optionalText(50000),
})

export type StoreOpeningHoursSlot = z.infer<typeof storeOpeningHoursSlotSchema>
export type UpdateStoreProfileInput = z.infer<typeof updateStoreProfileSchema>
