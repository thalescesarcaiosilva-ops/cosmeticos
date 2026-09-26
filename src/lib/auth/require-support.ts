import { getSessionUser } from '@/lib/auth/verify-session'
import { getUserRole, type AppRole } from '@/lib/auth/require-admin'

export async function requireSupportReader(): Promise<{ id: string; role: Extract<AppRole, 'admin' | 'support'> }> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }

  const role = await getUserRole(user.id)
  if (role !== 'support' && role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  return { id: user.id, role }
}
