#!/usr/bin/env node
/**
 * Gera supabase/schema-export/ a partir do Postgres remoto (somente estrutura).
 *
 * Uso:
 *   $env:SUPABASE_DB_PASSWORD="..."
 *   node scripts/build-schema-export.mjs
 */

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'supabase', 'schema-export')

const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

const password = process.env.SUPABASE_DB_PASSWORD
const dbUrl =
  process.env.DATABASE_URL ??
  (projectRef && password
    ? `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`
    : null)

if (!dbUrl) {
  console.error('Defina SUPABASE_DB_PASSWORD ou DATABASE_URL.')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const schemaFile = join(outDir, '00_full_schema_public_storage.sql')
console.log('Dump schema-only via Supabase CLI...')
execSync(
  `npx supabase db dump --db-url "${dbUrl}" --schema public,storage --file "${schemaFile}" --keep-comments`,
  { stdio: 'inherit', cwd: root, shell: true }
)

writeFileSync(
  join(outDir, '01_storage_buckets.sql'),
  `-- Buckets vazios (sem arquivos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('categories', 'categories', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('site-assets', 'site-assets', true, 5242880, ARRAY['image/jpeg','image/png','image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
`,
  'utf8'
)

writeFileSync(
  join(outDir, '99_structure_only_seed.sql'),
  `-- Seed mínimo — sem produtos, imagens, pedidos ou storage objects
INSERT INTO public.site_settings (id, store_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Sua Loja')
ON CONFLICT (id) DO NOTHING;
`,
  'utf8'
)

console.log(`Pronto: ${outDir}`)
