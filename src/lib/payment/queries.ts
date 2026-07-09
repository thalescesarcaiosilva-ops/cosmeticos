import { createClient } from '@/lib/supabase/server'
import { SITE_SETTINGS_ID } from '@/lib/layout/queries'
import { parseInstallmentInterestRates } from '@/lib/payment/installment-rates'
import { parsePaymentMethods } from '@/lib/payment/parse-payment-methods'
import {
  DEFAULT_CHECKOUT_PAYMENT_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  type CheckoutPaymentSettings,
  type PaymentSettings,
} from '@/types/payment'

export const PAYMENT_COLUMNS = `
  installment_max,
  installment_interest_free,
  installment_min_value,
  installment_interest_rate,
  installment_interest_rates,
  installment_text_free,
  installment_text_interest,
  payment_methods_config,
  payment_methods,
  payment_method_images
`

type PaymentRow = {
  installment_max: number | null
  installment_interest_free: number | null
  installment_min_value: number | null
  installment_interest_rate: number | null
  installment_interest_rates?: unknown
  installment_text_free: string | null
  installment_text_interest: string | null
  payment_methods_config?: unknown
  payment_methods?: unknown
  payment_method_images?: unknown
}

function mapPaymentSettings(row: PaymentRow | null): PaymentSettings {
  if (!row) return DEFAULT_PAYMENT_SETTINGS

  return {
    maxInstallments: row.installment_max ?? DEFAULT_PAYMENT_SETTINGS.maxInstallments,
    interestFreeInstallments:
      row.installment_interest_free ?? DEFAULT_PAYMENT_SETTINGS.interestFreeInstallments,
    minInstallmentValue: Number(
      row.installment_min_value ?? DEFAULT_PAYMENT_SETTINGS.minInstallmentValue
    ),
    monthlyInterestRate: Number(
      row.installment_interest_rate ?? DEFAULT_PAYMENT_SETTINGS.monthlyInterestRate
    ),
    installmentInterestRates: parseInstallmentInterestRates(row.installment_interest_rates),
    installmentTextInterestFree:
      row.installment_text_free ?? DEFAULT_PAYMENT_SETTINGS.installmentTextInterestFree,
    installmentTextWithInterest:
      row.installment_text_interest ?? DEFAULT_PAYMENT_SETTINGS.installmentTextWithInterest,
    paymentMethods: parsePaymentMethods(row),
  }
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select(PAYMENT_COLUMNS)
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (error || !data) return DEFAULT_PAYMENT_SETTINGS
  return mapPaymentSettings(data as PaymentRow)
}

function parseCheckoutPaymentConfig(raw: unknown): CheckoutPaymentSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_CHECKOUT_PAYMENT_SETTINGS
  const row = raw as Record<string, unknown>
  return {
    pixEnabled: row.pixEnabled !== false,
    pixDiscount: Math.max(0, Math.min(100, Number(row.pixDiscount ?? 0) || 0)),
    cardEnabled: row.cardEnabled !== false,
  }
}

export async function getCheckoutPaymentSettings(): Promise<CheckoutPaymentSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('payment_checkout_config')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  if (error || !data) return DEFAULT_CHECKOUT_PAYMENT_SETTINGS
  return parseCheckoutPaymentConfig(
    (data as { payment_checkout_config?: unknown }).payment_checkout_config
  )
}

export { mapPaymentSettings, parseCheckoutPaymentConfig }
