import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonSuccess } from '@/lib/api/response'
import { requireAdminUser } from '@/lib/auth/require-admin'
import {
  createFooterMenuSchema,
  createFooterMenuItemSchema,
} from '@/schemas/footer-menu-schema'

const MENU_COLUMNS = 'id, title, sort_order, active, created_at, updated_at'
const ITEM_COLUMNS = 'id, menu_id, label, href, sort_order, active, created_at'

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

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const supabase = await createClient()

  const { data: menus, error: menusError } = await supabase
    .from('footer_menus')
    .select(MENU_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (menusError) {
    if (menusError.code === '42P01') {
      return jsonError('Aplique a migration footer_menus no Supabase.', 503)
    }
    return jsonError('Não foi possível carregar os menus', 500)
  }

  const { data: items, error: itemsError } = await supabase
    .from('footer_menu_items')
    .select(ITEM_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (itemsError) {
    return jsonError('Não foi possível carregar os links dos menus', 500)
  }

  const itemsByMenu = new Map<string, typeof items>()
  for (const item of items ?? []) {
    const list = itemsByMenu.get(item.menu_id) ?? []
    list.push(item)
    itemsByMenu.set(item.menu_id, list)
  }

  const result = (menus ?? []).map((menu) => ({
    ...menu,
    items: itemsByMenu.get(menu.id) ?? [],
  }))

  return jsonSuccess(result)
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

  const parsed = createFooterMenuSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_menus')
    .insert(parsed.data)
    .select(MENU_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o menu', 400)
  }

  revalidateTag('site-layout', 'max')
  return jsonSuccess({ ...data, items: [] }, 'Menu criado', 201)
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Dados inválidos', 400)
  }

  const parsed = createFooterMenuItemSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Dados inválidos', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('footer_menu_items')
    .insert(parsed.data)
    .select(ITEM_COLUMNS)
    .single()

  if (error || !data) {
    return jsonError('Não foi possível criar o link', 400)
  }

  revalidateTag('site-layout', 'max')
  return jsonSuccess(data, 'Link adicionado', 201)
}
