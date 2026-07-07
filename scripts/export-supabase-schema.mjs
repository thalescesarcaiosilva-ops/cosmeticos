#!/usr/bin/env node
/**
 * Exporta SOMENTE a estrutura (schema) do Supabase remoto — sem produtos, imagens ou pedidos.
 *
 * Uso:
 *   $env:SUPABASE_DB_PASSWORD="sua-senha-do-banco"
 *   node scripts/export-supabase-schema.mjs
 *
 * A senha está em: Supabase Dashboard → Project Settings → Database → Database password
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
  console.error(`
Erro: informe a conexão do Postgres.

Opção A (recomendada):
  $env:SUPABASE_DB_PASSWORD="..."
  node scripts/export-supabase-schema.mjs

Opção B:
  $env:DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"
  node scripts/export-supabase-schema.mjs
`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const schemaFile = join(outDir, '00_schema_public_storage.sql')
const dataStructureFile = join(outDir, '99_structure_only_seed.sql')

console.log('Exportando schema (public + storage)...')
execSync(
  `npx supabase db dump --db-url "${dbUrl}" --schema public,storage --file "${schemaFile}" --keep-comments`,
  { stdio: 'inherit', cwd: root, shell: true }
)

console.log('Gerando seed estrutural vazio (sem catálogo)...')
writeFileSync(
  dataStructureFile,
  `-- Seed mínimo: apenas registros estruturais vazios (sem produtos, mídias, pedidos)
-- Execute DEPOIS do schema, no novo projeto.

-- site_settings: 1 linha com defaults (ajuste store_name no admin)
INSERT INTO public.site_settings (id, store_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Sua Loja')
ON CONFLICT (id) DO NOTHING;

-- Nenhum produto, categoria, banner, media_assets, order ou storage object é copiado.
`,
  'utf8'
)

const bucketsFile = join(outDir, '01_storage_buckets.sql')
writeFileSync(
  bucketsFile,
  `-- Buckets (estrutura). Arquivos dentro dos buckets NÃO são copiados.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('categories', 'categories', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('site-assets', 'site-assets', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
`,
  'utf8'
)

console.log(`
Export concluído em supabase/schema-export/:
  - 00_schema_public_storage.sql  (tabelas, funções, RLS, índices)
  - 01_storage_buckets.sql        (buckets vazios)
  - 99_structure_only_seed.sql      (1 linha site_settings, sem catálogo)

Próximo passo: veja supabase/schema-export/README.md
`)
