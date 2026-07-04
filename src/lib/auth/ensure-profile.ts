import { createAdminClient } from '@/lib/supabase/admin'

export async function ensureUserProfile(
  userId: string,
  name: string
): Promise<'admin' | 'customer'> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    await admin.from('profiles').insert({
      id: userId,
      name,
      role: 'customer',
    })
    return 'customer'
  }

  if (profile.role === 'admin' || profile.role === 'customer') {
    return profile.role
  }

  return 'customer'
}
