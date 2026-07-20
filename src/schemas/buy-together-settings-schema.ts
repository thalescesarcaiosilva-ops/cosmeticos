import { z } from 'zod'
import { DEFAULT_BUY_TOGETHER_SETTINGS } from '@/types/buy-together-settings'

const optionalCssValue = z
  .string()
  .max(120)
  .optional()
  .nullable()
  .transform((v) => (v == null ? '' : v.trim()))

const buyTogetherCssSchema = z.object({
  sectionBackground: optionalCssValue,
  sectionBorderColor: optionalCssValue,
  sectionBorderRadius: optionalCssValue,
  titleColor: optionalCssValue,
  subtitleColor: optionalCssValue,
  priceColor: optionalCssValue,
  badgeBackground: optionalCssValue,
  badgeTextColor: optionalCssValue,
  buttonBackground: optionalCssValue,
  buttonTextColor: optionalCssValue,
  savingsColor: optionalCssValue,
  customCss: z
    .string()
    .max(8000)
    .optional()
    .nullable()
    .transform((v) => (v == null ? '' : v.trim())),
})

export const buyTogetherSettingsSchema = z.object({
  enabled: z.boolean(),
  defaultDiscountPercent: z.number().min(0).max(90),
  maxBundleTotal: z.number().min(1).max(999999),
  title: z.string().min(1).max(80),
  eyebrow: z.string().max(40),
  subtitleFallback: z.string().max(200),
  ctaLabel: z.string().min(1).max(80),
  ctaAddedLabel: z.string().min(1).max(80),
  css: buyTogetherCssSchema,
})

export const updateBuyTogetherSettingsSchema = buyTogetherSettingsSchema

export type BuyTogetherSettingsInput = z.infer<typeof buyTogetherSettingsSchema>

export function normalizeBuyTogetherSettings(raw: unknown): BuyTogetherSettingsInput {
  const base = DEFAULT_BUY_TOGETHER_SETTINGS
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const cssRaw =
    row.css && typeof row.css === 'object' && !Array.isArray(row.css)
      ? (row.css as Record<string, unknown>)
      : {}

  const candidate = {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : base.enabled,
    defaultDiscountPercent:
      typeof row.defaultDiscountPercent === 'number'
        ? row.defaultDiscountPercent
        : base.defaultDiscountPercent,
    maxBundleTotal:
      typeof row.maxBundleTotal === 'number' ? row.maxBundleTotal : base.maxBundleTotal,
    title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : base.title,
    eyebrow: typeof row.eyebrow === 'string' ? row.eyebrow.trim() : base.eyebrow,
    subtitleFallback:
      typeof row.subtitleFallback === 'string' && row.subtitleFallback.trim()
        ? row.subtitleFallback.trim()
        : base.subtitleFallback,
    ctaLabel:
      typeof row.ctaLabel === 'string' && row.ctaLabel.trim()
        ? row.ctaLabel.trim()
        : base.ctaLabel,
    ctaAddedLabel:
      typeof row.ctaAddedLabel === 'string' && row.ctaAddedLabel.trim()
        ? row.ctaAddedLabel.trim()
        : base.ctaAddedLabel,
    css: {
      ...base.css,
      ...Object.fromEntries(
        Object.entries(cssRaw).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : '',
        ])
      ),
    },
  }

  const parsed = buyTogetherSettingsSchema.safeParse(candidate)
  return parsed.success ? parsed.data : base
}
