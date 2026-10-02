import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeCouponCode, quoteCouponDiscount } from '@/lib/checkout/coupon-math'

export async function resolveActiveCoupon(
  code: string,
  merchandiseTotal: number
): Promise<{ code: string; discountAmount: number } | null> {
  const normalized = normalizeCouponCode(code)
  if (!normalized) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coupons')
    .select('code, discount_type, discount_value, active')
    .eq('code', normalized)
    .eq('active', true)
    .maybeSingle()

  if (error || !data) return null
  if (data.discount_type !== 'percent' && data.discount_type !== 'fixed') return null

  return {
    code: data.code,
    discountAmount: quoteCouponDiscount({
      discountType: data.discount_type,
      discountValue: Number(data.discount_value),
      merchandiseTotal,
    }),
  }
}
