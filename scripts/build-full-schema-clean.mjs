#!/usr/bin/env node
/**
 * Monta supabase/sql/FULL_SCHEMA_CLEAN.sql — estrutura completa (tabelas, RLS,
 * funções, storage) sem produtos/imagens/pedidos. Para colar no SQL Editor
 * de um projeto Supabase novo.
 *
 * Uso: node scripts/build-full-schema-clean.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outFile = join(root, 'supabase', 'sql', 'FULL_SCHEMA_CLEAN.sql')
const exportReadme = join(root, 'supabase', 'schema-export', 'README.md')

/** Ordem base (PARTEs) — núcleo do schema. */
const PARTE_ORDER = [
  'PARTE_1_tabelas.sql',
  'PARTE_2_seguranca_profiles.sql',
  'PARTE_3_rls_policies.sql',
  'PARTE_4_storage.sql',
  'PARTE_6_fix_signup.sql',
  'PARTE_8_fix_admin_promotion.sql',
  'PARTE_9_products_media.sql',
  'PARTE_10_payment_settings.sql',
  'PARTE_11_home_banners.sql',
  'PARTE_12_footer_system.sql',
  'PARTE_12_woocommerce_import.sql',
  'PARTE_13_shipping_methods.sql',
  'PARTE_14_collection_fields.sql',
  'PARTE_14b_merge_seal_into_image.sql',
  'PARTE_15_banner_device_target.sql',
]

/** Seeds de layout de demonstração — tabelas devem ficar limpas. */
const STRIP_INSERT_TABLES = new Set([
  'policy_links',
  'social_links',
  'menu_items',
  'footer_pages',
  'footer_menus',
  'footer_menu_items',
  'footer_assets',
  'home_banners',
  'products',
  'categories',
  'brands',
  'media_assets',
  'product_images',
  'product_categories',
  'orders',
  'order_items',
])

function listSql(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

/**
 * Remove INSERT de seed em tabelas de catálogo/layout,
 * sem tocar em INSERT dentro de funções (blocos $$ ... $$).
 */
function stripDemoInserts(sql) {
  let out = ''
  let i = 0
  let inDollar = false
  let dollarTag = null

  while (i < sql.length) {
    if (!inDollar) {
      const dollarOpen = sql.slice(i).match(/^\$([A-Za-z0-9_]*)\$/)
      if (dollarOpen) {
        inDollar = true
        dollarTag = dollarOpen[0]
        out += dollarTag
        i += dollarTag.length
        continue
      }

      const insertMatch = sql.slice(i).match(/^INSERT\s+INTO\s+(?:public\.)?([a-z0-9_]+)/i)
      if (insertMatch) {
        const table = insertMatch[1].toLowerCase()
        if (STRIP_INSERT_TABLES.has(table)) {
          let j = i + insertMatch[0].length
          let inStr = false
          while (j < sql.length) {
            const ch = sql[j]
            if (ch === "'" && sql[j + 1] === "'") {
              j += 2
              continue
            }
            if (ch === "'") {
              inStr = !inStr
              j += 1
              continue
            }
            if (!inStr && ch === ';') {
              j += 1
              break
            }
            j += 1
          }
          out += `-- [omitido seed de ${table} — schema limpo]\n`
          i = j
          continue
        }
      }

      out += sql[i]
      i += 1
      continue
    }

    if (sql.startsWith(dollarTag, i)) {
      out += dollarTag
      i += dollarTag.length
      inDollar = false
      dollarTag = null
      continue
    }
    out += sql[i]
    i += 1
  }

  return out
}

/** Torna CREATE TABLE/INDEX/POLICY e seeds de site_settings seguros para reexecução. */
function makeIdempotent(sql) {
  let out = sql
    .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
    .replace(/CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
    .replace(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS ')

  // Trigger de signup: evita "already exists" quando PARTE_6 + migration repetem
  out = out.replace(
    /CREATE\s+TRIGGER\s+on_auth_user_created\b/gi,
    'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;\nCREATE TRIGGER on_auth_user_created'
  )

  // CREATE POLICY ... ON table → DROP POLICY IF EXISTS antes
  // Cobre: CREATE POLICY "name" ON table  e  CREATE POLICY "name"\n  ON table
  out = out.replace(
    /CREATE\s+POLICY\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+ON\s+((?:public\.|storage\.)?[a-zA-Z0-9_]+)/gi,
    (match, quoted, bare, table) => {
      const name = quoted || bare
      const quotedName = `"${name}"`
      // Evita duplicar DROP se já existir imediatamente antes (heurística simples)
      return `DROP POLICY IF EXISTS ${quotedName} ON ${table};\nCREATE POLICY ${quotedName} ON ${table}`
    }
  )

  // INSERT site_settings sem ON CONFLICT → adiciona
  out = out.replace(
    /INSERT\s+INTO\s+(?:public\.)?site_settings\s*\(([^)]+)\)\s*VALUES\s*\(([^;]+)\);/gi,
    (match, cols, vals) => {
      if (/ON\s+CONFLICT/i.test(match)) return match
      return `INSERT INTO public.site_settings (${cols}) VALUES (${vals})\nON CONFLICT (id) DO NOTHING;`
    }
  )

  return out
}

function section(title, body) {
  return `
-- =============================================================================
-- ${title}
-- =============================================================================
${body.trim()}
`
}

const partesDir = join(root, 'supabase', 'sql')
const migDir = join(root, 'supabase', 'migrations')
const scriptsMigDir = join(root, 'scripts', 'migrations')

const parts = []

parts.push(`-- =============================================================================
-- FULL_SCHEMA_CLEAN.sql
-- Estrutura completa da loja para um Supabase NOVO (tabelas limpas).
-- Gerado por: node scripts/build-full-schema-clean.mjs
-- Gerado em: ${new Date().toISOString().slice(0, 10)}
--
-- Inclui: tabelas, funções, triggers, RLS, buckets de storage (vazios).
-- NÃO inclui: produtos, mídias, pedidos, usuários, arquivos em storage.objects.
--
-- Como usar:
-- 1. Crie um projeto vazio no Supabase Dashboard
-- 2. SQL Editor → cole este arquivo inteiro → Run
-- 3. Auth → crie um usuário → promova admin:
--      UPDATE public.profiles SET role = 'admin' WHERE id = '<uuid>';
-- 4. Aponte o .env.local do app para o novo projeto
-- =============================================================================
`)

for (const name of PARTE_ORDER) {
  const path = join(partesDir, name)
  const raw = readFileSync(path, 'utf8')
  parts.push(section(`PARTE · ${name}`, makeIdempotent(stripDemoInserts(raw))))
}

// Seed mínimo obrigatório (site_settings) — sem catálogo
parts.push(section(
  'SEED MÍNIMO (sem catálogo)',
  `-- site_settings: 1 linha estrutural (ajuste no admin depois)
INSERT INTO public.site_settings (id, store_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Sua Loja')
ON CONFLICT (id) DO NOTHING;
`
))

// Migrations do repo (idempotentes: ADD COLUMN IF NOT EXISTS, CREATE IF NOT EXISTS)
const migrationFiles = [
  ...listSql(migDir),
  ...listSql(scriptsMigDir),
].sort((a, b) => {
  const ba = a.split(/[/\\]/).pop()
  const bb = b.split(/[/\\]/).pop()
  return ba.localeCompare(bb)
})

// Evitar reaplicar seed de layout demo
const skipMigrationBasenames = new Set([
  '202506160003_site_layout_seed.sql',
])

for (const path of migrationFiles) {
  const base = path.split(/[/\\]/).pop()
  if (skipMigrationBasenames.has(base)) {
    parts.push(section(`MIGRATION omitida (seed demo) · ${base}`, '-- (conteúdo de demonstração removido)'))
    continue
  }
  const raw = readFileSync(path, 'utf8')
  parts.push(section(`MIGRATION · ${base}`, makeIdempotent(stripDemoInserts(raw))))
}

// Garante bucket payment-proofs + policies (caso PARTE_4 antiga)
parts.push(section(
  'STORAGE · payment-proofs (privado)',
  `
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "storage_payment_proofs_admin" ON storage.objects;
CREATE POLICY "storage_payment_proofs_admin" ON storage.objects
  FOR ALL
  USING (bucket_id = 'payment-proofs' AND public.is_admin())
  WITH CHECK (bucket_id = 'payment-proofs' AND public.is_admin());
`
))

const output = parts.join('\n')
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, output, 'utf8')

const kb = Math.round(Buffer.byteLength(output) / 1024)
console.log(`Gerado: ${outFile} (${kb} KB, ${migrationFiles.length} migrations + PARTEs)`)

// Atualiza ponteiro no README do schema-export
try {
  let readme = readFileSync(exportReadme, 'utf8')
  if (!readme.includes('FULL_SCHEMA_CLEAN.sql')) {
    readme =
      `> **Arquivo único recomendado:** [\`../sql/FULL_SCHEMA_CLEAN.sql\`](../sql/FULL_SCHEMA_CLEAN.sql) — rode no SQL Editor de um projeto novo (tabelas limpas).\n\n` +
      readme
    writeFileSync(exportReadme, readme, 'utf8')
  }
} catch {
  // README opcional
}
