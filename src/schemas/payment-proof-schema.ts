import { z } from 'zod'

export const paymentProofSourceSchema = z.enum(['checkout', 'thank_you', 'account'])

export const paymentProofStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
])

export const paymentProofReviewSchema = z.object({
  proofId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
})

export type PaymentProofSource = z.infer<typeof paymentProofSourceSchema>
export type PaymentProofReviewInput = z.infer<typeof paymentProofReviewSchema>

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024
export const PAYMENT_PROOF_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const
