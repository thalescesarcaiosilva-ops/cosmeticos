import { z } from 'zod'
import { normalizeCouponCode } from '@/lib/checkout/coupon-math'

const discountType = z.enum(['percent', 'fixed'])

function refineDiscount(
  value: { discount_type: 'percent' | 'fixed'; discount_value: number },
  ctx: z.RefinementCtx
) {
  if (value.discount_type === 'percent' && value.discount_value > 100) {
    ctx.addIssue({
      code: 'custom',
      path: ['discount_value'],
      message: 'A porcentagem deve ser de até 100',
    })
  }
}

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Informe o nome do cupom')
      .max(40, 'Nome muito longo')
      .transform(normalizeCouponCode),
    discount_type: discountType,
    discount_value: z.coerce.number().positive('Informe um desconto maior que zero'),
    active: z.boolean().optional().default(true),
  })
  .superRefine(refineDiscount)

export const updateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform(normalizeCouponCode)
      .optional(),
    discount_type: discountType.optional(),
    discount_value: z.coerce.number().positive().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.discount_type && value.discount_value != null) {
      refineDiscount(
        { discount_type: value.discount_type, discount_value: value.discount_value },
        ctx
      )
    }
  })

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  merchandiseTotal: z.coerce.number().min(0).max(1_000_000),
})
