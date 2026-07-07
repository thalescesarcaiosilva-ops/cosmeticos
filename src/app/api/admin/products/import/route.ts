import { revalidatePath } from 'next/cache'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { importWooCommerceBatch } from '@/lib/import/run-woocommerce-import'
import type { WooCommerceProductRow } from '@/lib/import/woocommerce-csv'
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
    const rows: WooCommerceProductRow[] = parsed.data.rows.map((row) => ({
      wooId: row.wooId,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      shortDescription: row.shortDescription ?? null,
      sku: row.sku ?? null,
      gtin: row.gtin ?? null,
      price: row.price,
      originalPrice: row.originalPrice ?? null,
      stock: row.stock,
      active: row.active,
      brandName: row.brandName ?? null,
      categoryNames: row.categoryNames,
      images: row.images,
      metaTitle: row.metaTitle ?? null,
      metaDescription: row.metaDescription ?? null,
      productType: row.productType,
      variationCount: row.variationCount,
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
