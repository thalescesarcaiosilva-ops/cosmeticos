import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { importWooCommerceBatch } from '@/lib/import/run-woocommerce-import'
import { importBatchSchema } from '@/schemas/import-schema'

export const maxDuration = 300

async function requireAdmin() {
  try {
    return await requireAdminUser()
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return jsonError('Não autorizado', 401, 'UNAUTHORIZED')
    }
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return jsonError('Acesso negado', 403, 'FORBIDDEN')
    }
    return jsonError('Erro interno', 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = importBatchSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  try {
    const rows = parsed.data.rows.map((row) => ({
      ...row,
      description: row.description ?? null,
      shortDescription: row.shortDescription ?? null,
      sku: row.sku ?? null,
      gtin: row.gtin ?? null,
      originalPrice: row.originalPrice ?? null,
      brandName: row.brandName ?? null,
      metaTitle: row.metaTitle ?? null,
      metaDescription: row.metaDescription ?? null,
    }))

    const result = await importWooCommerceBatch(rows, {
      updateImages: parsed.data.updateImages ?? true,
      adminUserId: auth.id,
    })

    revalidatePath('/')
    revalidatePath('/admin/produtos')

    return jsonSuccess(result, 'Lote importado')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha na importação'
    return jsonError(message, 500)
  }
}
