import { createAdminClient } from '@/lib/supabase/admin'
import { assertOrderAccess, OrderAccessError } from '@/lib/checkout/order-access'
import { confirmCheckoutPayment } from '@/lib/checkout/create-order'
import {
  PAYMENT_PROOF_ALLOWED_TYPES,
  PAYMENT_PROOF_MAX_BYTES,
  type PaymentProofSource,
} from '@/schemas/payment-proof-schema'

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs'

export type OrderPaymentProof = {
  id: string
  order_id: string
  message: string | null
  storage_path: string
  mime_type: string
  file_name: string
  size_bytes: number
  source: string
  status: string
  created_at: string
  reviewed_at: string | null
  signedUrl?: string | null
}

export class PaymentProofError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message)
    this.name = 'PaymentProofError'
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'comprovante'
}

export async function uploadOrderPaymentProof(params: {
  orderId: string
  userId?: string | null
  guestToken?: string | null
  file: File
  message?: string | null
  source: PaymentProofSource
}): Promise<OrderPaymentProof> {
  try {
    await assertOrderAccess({
      orderId: params.orderId,
      userId: params.userId,
      guestToken: params.guestToken,
    })
  } catch (e) {
    if (e instanceof OrderAccessError) {
      throw new PaymentProofError(e.message, 'FORBIDDEN')
    }
    throw e
  }

  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, status, payment_status, payment_method')
    .eq('id', params.orderId)
    .maybeSingle()

  if (orderError || !order) {
    throw new PaymentProofError('Pedido não encontrado', 'ORDER_NOT_FOUND')
  }

  const isPaid = order.status === 'confirmed' || order.payment_status === 'paid'
  if (isPaid) {
    throw new PaymentProofError('Este pedido já está pago', 'ALREADY_PAID')
  }

  if (!['pending', 'cancelled'].includes(order.status)) {
    throw new PaymentProofError(
      'Não é possível enviar comprovante para este pedido',
      'ORDER_NOT_ELIGIBLE'
    )
  }

  if (!PAYMENT_PROOF_ALLOWED_TYPES.includes(params.file.type as (typeof PAYMENT_PROOF_ALLOWED_TYPES)[number])) {
    throw new PaymentProofError(
      'Envie uma imagem (JPG, PNG, WEBP) ou PDF do comprovante',
      'INVALID_FILE_TYPE'
    )
  }

  if (params.file.size <= 0 || params.file.size > PAYMENT_PROOF_MAX_BYTES) {
    throw new PaymentProofError('Arquivo deve ter no máximo 5 MB', 'FILE_TOO_LARGE')
  }

  const { count } = await admin
    .from('order_payment_proofs')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', params.orderId)
    .eq('status', 'pending_review')

  if ((count ?? 0) >= 3) {
    throw new PaymentProofError(
      'Já existem comprovantes em análise para este pedido. Aguarde a revisão.',
      'TOO_MANY_PROOFS'
    )
  }

  const ext =
    params.file.type === 'application/pdf'
      ? 'pdf'
      : params.file.type.includes('png')
        ? 'png'
        : params.file.type.includes('webp')
          ? 'webp'
          : 'jpg'

  const storagePath = `${params.orderId}/${Date.now()}-${sanitizeFileName(params.file.name)}.${ext}`
  const buffer = Buffer.from(await params.file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: params.file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new PaymentProofError(
      'Falha no upload do comprovante. Tente novamente.',
      'UPLOAD_FAILED'
    )
  }

  const { data: proof, error: insertError } = await admin
    .from('order_payment_proofs')
    .insert({
      order_id: params.orderId,
      message: params.message?.trim() || null,
      storage_path: storagePath,
      mime_type: params.file.type,
      file_name: params.file.name.slice(0, 200),
      size_bytes: params.file.size,
      source: params.source,
      status: 'pending_review',
    })
    .select(
      'id, order_id, message, storage_path, mime_type, file_name, size_bytes, source, status, created_at, reviewed_at'
    )
    .single()

  if (insertError || !proof) {
    await admin.storage.from(PAYMENT_PROOFS_BUCKET).remove([storagePath])
    throw new PaymentProofError('Não foi possível registrar o comprovante', 'INSERT_FAILED')
  }

  return proof as OrderPaymentProof
}

export async function listProofsForOrder(orderId: string): Promise<OrderPaymentProof[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('order_payment_proofs')
    .select(
      'id, order_id, message, storage_path, mime_type, file_name, size_bytes, source, status, created_at, reviewed_at'
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const proofs: OrderPaymentProof[] = []
  for (const row of data) {
    const { data: signed } = await admin.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60)
    proofs.push({
      ...(row as OrderPaymentProof),
      signedUrl: signed?.signedUrl ?? null,
    })
  }
  return proofs
}

export async function reviewPaymentProof(params: {
  proofId: string
  action: 'approve' | 'reject'
  adminUserId?: string | null
}): Promise<{ orderId: string }> {
  const admin = createAdminClient()
  const { data: proof, error } = await admin
    .from('order_payment_proofs')
    .select('id, order_id, status')
    .eq('id', params.proofId)
    .maybeSingle()

  if (error || !proof) {
    throw new PaymentProofError('Comprovante não encontrado', 'PROOF_NOT_FOUND')
  }

  if (proof.status !== 'pending_review') {
    throw new PaymentProofError('Este comprovante já foi revisado', 'ALREADY_REVIEWED')
  }

  const nextStatus = params.action === 'approve' ? 'approved' : 'rejected'
  const { error: updateError } = await admin
    .from('order_payment_proofs')
    .update({
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: params.adminUserId ?? null,
    })
    .eq('id', params.proofId)

  if (updateError) {
    throw new PaymentProofError('Não foi possível atualizar o comprovante', 'UPDATE_FAILED')
  }

  if (params.action === 'approve') {
    // Pedidos cancelados por timeout do Pix ainda podem ter sido pagos
    await admin
      .from('orders')
      .update({ status: 'pending', payment_status: 'pending' })
      .eq('id', proof.order_id)
      .eq('status', 'cancelled')

    await confirmCheckoutPayment({
      orderId: proof.order_id,
      paymentMethod: 'pix',
    })
  }

  return { orderId: proof.order_id }
}
