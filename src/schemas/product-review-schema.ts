import { z } from 'zod'

export const createProductReviewSchema = z.object({
  product_id: z.string().uuid(),
  author_name: z.string().min(2, 'Nome obrigatório').max(120),
  author_email: z.string().email('E-mail inválido').max(180).nullable().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(140).nullable().optional(),
  comment: z.string().min(8, 'Comentário muito curto').max(1500),
})

export const productReviewImportRowSchema = z.object({
  authorName: z.string().min(2).max(120),
  authorEmail: z.string().email().max(180).nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(140).nullable(),
  comment: z.string().min(8).max(1500),
})

export const importProductReviewsSchema = z.object({
  product_id: z.string().uuid(),
  rows: z.array(productReviewImportRowSchema).min(1).max(500),
})

export const reviewModerationSchema = z.object({
  approved: z.boolean(),
})
