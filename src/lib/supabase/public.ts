import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function isSupabasePublicConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Cliente somente leitura para dados públicos (layout, catálogo).
 * Usa anon key + RLS — sem cookies de sessão.
 */
export function createPublicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.'
    )
  }

  return createClient(url, anonKey)
}
