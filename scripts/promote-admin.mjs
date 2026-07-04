/**
 * Promove um usuário a admin via service_role (contorna o trigger antigo).
 *
 * Uso:
 *   node --env-file=.env.local scripts/promote-admin.mjs admin@gmail.com
 */
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Uso: node --env-file=.env.local scripts/promote-admin.mjs seu@email.com')
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: usersData, error: listError } = await admin.auth.admin.listUsers()

if (listError) {
  console.error('Erro ao listar usuários:', listError.message)
  process.exit(1)
}

const user = usersData.users.find((u) => u.email?.toLowerCase() === email)

if (!user) {
  console.error(`Usuário não encontrado no Auth: ${email}`)
  console.error('Cadastre-se primeiro em /conta/cadastro')
  process.exit(1)
}

const name =
  (user.user_metadata?.name as string | undefined) ??
  user.email?.split('@')[0] ??
  'Admin'

const { data: profile, error: selectError } = await admin
  .from('profiles')
  .select('id, role, name')
  .eq('id', user.id)
  .maybeSingle()

if (selectError) {
  console.error('Erro ao ler perfil:', selectError.message)
  process.exit(1)
}

if (!profile) {
  const { error: insertError } = await admin.from('profiles').insert({
    id: user.id,
    name,
    role: 'admin',
  })
  if (insertError) {
    console.error('Erro ao criar perfil admin:', insertError.message)
    console.error('Rode supabase/sql/PARTE_8_fix_admin_promotion.sql no Supabase primeiro.')
    process.exit(1)
  }
  console.log(`Perfil criado como admin: ${email}`)
} else {
  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id)
    .select('role')
    .single()

  if (updateError) {
    console.error('Erro ao promover:', updateError.message)
    console.error('Rode supabase/sql/PARTE_8_fix_admin_promotion.sql no Supabase primeiro.')
    process.exit(1)
  }

  if (updated?.role !== 'admin') {
    console.error('Promoção falhou — role ainda é:', updated?.role)
    console.error('Rode supabase/sql/PARTE_8_fix_admin_promotion.sql no Supabase.')
    process.exit(1)
  }

  console.log(`Promovido a admin: ${email} (role=${updated.role})`)
}

console.log('Acesse /conta/login e depois /admin')
