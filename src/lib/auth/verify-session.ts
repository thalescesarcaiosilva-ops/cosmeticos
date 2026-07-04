import { createClient } from '@/lib/supabase/server'

export type SessionUser = {
  id: string
  email: string | undefined
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return { id: user.id, email: user.email }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}
