import { createClient } from '@/lib/supabase/server'
import { getSessionUser, type SessionUser } from '@/lib/auth/verify-session'

export type AppRole = 'customer' | 'admin' | 'support'

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data?.role) {
    return null
  }

  if (data.role === 'admin' || data.role === 'customer' || data.role === 'support') {
    return data.role
  }

  return null
}

export async function requireAdminUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }

  const role = await getUserRole(user.id)
  if (role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  return user
}
