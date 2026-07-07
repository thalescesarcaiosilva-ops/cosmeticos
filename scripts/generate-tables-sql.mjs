#!/usr/bin/env node
/**
 * Gera CREATE TABLE a partir de JSON de colunas (information_schema).
 * Uso interno / regeneração: node scripts/generate-tables-sql.mjs < columns.json > supabase/schema-export/02_tables.sql
 */

import { readFileSync } from 'node:fs'

const inputPath = process.argv[2]
const raw = inputPath ? readFileSync(inputPath, 'utf8') : readFileSync(0, 'utf8')

function extractRows(text) {
  try {
    const outer = JSON.parse(text)
    if (typeof outer.result === 'string') {
      const inner = outer.result.match(/<untrusted-data-[^>]+>\n(\[[\s\S]*?\])\n/)?.[1]
      if (inner) return JSON.parse(inner)
    }
  } catch {
    // fall through
  }
  throw new Error('Não foi possível extrair colunas do arquivo MCP')
}

const rows = extractRows(raw)

function pgType(row) {
  const { udt_name, data_type, character_maximum_length, numeric_precision, numeric_scale } = row
  if (udt_name === 'uuid') return 'uuid'
  if (udt_name === 'text') return 'text'
  if (udt_name === 'jsonb') return 'jsonb'
  if (udt_name === 'bool') return 'boolean'
  if (udt_name === 'int2') return 'smallint'
  if (udt_name === 'int4') return 'integer'
  if (udt_name === 'int8') return 'bigint'
  if (udt_name === 'timestamptz') return 'timestamptz'
  if (udt_name === 'numeric') {
    if (numeric_precision && numeric_scale != null) return `numeric(${numeric_precision},${numeric_scale})`
    return 'numeric'
  }
  if (udt_name === 'varchar') {
    return character_maximum_length ? `varchar(${character_maximum_length})` : 'varchar'
  }
  if (udt_name === 'bpchar') {
    return character_maximum_length ? `char(${character_maximum_length})` : 'char'
  }
  if (udt_name === '_text') return 'text[]'
  return data_type
}

function colDef(row) {
  let def = pgType(row)
  if (row.is_generated === 'ALWAYS' && row.generation_expression) {
    return `${def} GENERATED ALWAYS AS (${row.generation_expression}) STORED`
  }
  if (row.column_default != null) {
    def += ` DEFAULT ${row.column_default}`
  }
  if (row.is_nullable === 'NO') def += ' NOT NULL'
  return def
}

const byTable = new Map()
for (const row of rows) {
  if (!byTable.has(row.table_name)) byTable.set(row.table_name, [])
  byTable.get(row.table_name).push(row)
}

const tableOrder = [
  'profiles', 'brands', 'categories', 'products', 'product_categories', 'product_images',
  'media_assets', 'product_favorites', 'product_reviews', 'addresses', 'shipping_methods',
  'orders', 'order_items', 'webhook_events', 'site_settings', 'menu_items', 'home_banners',
  'footer_menus', 'footer_menu_items', 'footer_pages', 'footer_assets', 'policy_links',
  'social_links', 'contact_messages'
]

console.log('-- Tabelas public (sem dados)\n')
for (const table of tableOrder) {
  const cols = byTable.get(table)
  if (!cols) continue
  console.log(`CREATE TABLE IF NOT EXISTS public.${table} (`)
  console.log(
    cols.map((c) => `  ${c.column_name} ${colDef(c)}`).join(',\n')
  )
  console.log(');\n')
}
