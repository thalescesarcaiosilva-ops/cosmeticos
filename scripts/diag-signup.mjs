import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(url, key)

const email = `diag.${Date.now()}@gmail.com`
console.log('signUp:', email)

const { data, error } = await supabase.auth.signUp({
  email,
  password: 'Senha123',
  options: { data: { name: 'Diag' } },
})

console.log('error:', error ? { message: error.message, code: error.code, status: error.status, name: error.name } : null)
console.log('user:', data.user ? { id: data.user.id, identities: data.user.identities?.length } : null)
console.log('session:', !!data.session)
