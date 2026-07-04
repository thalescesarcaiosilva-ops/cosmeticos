import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const email = `trigger.test.${Date.now()}@gmail.com`
  console.log('Creating user via admin (bypass email):', email)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'Senha123',
    email_confirm: true,
    user_metadata: { name: 'Trigger Test' },
  })

  if (error) {
    console.error('AUTH ERROR:', JSON.stringify(error, null, 2))
    process.exit(1)
  }

  console.log('User created:', data.user?.id)

  const userId = data.user?.id
  if (!userId) {
    console.error('No user id returned')
    process.exit(1)
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('PROFILE QUERY ERROR:', profileError.message)
  } else if (!profile) {
    console.error('PROFILE MISSING — trigger handle_new_user may have failed')
  } else {
    console.log('Profile OK:', profile)
  }

  await admin.auth.admin.deleteUser(userId)
  console.log('Test user deleted.')
}

main().catch(console.error)
