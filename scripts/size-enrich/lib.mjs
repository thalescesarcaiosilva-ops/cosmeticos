// Utilitarios compartilhados: env, Supabase REST, parsing de tamanho e normalizacao.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CACHE_DIR = path.join(ROOT, 'scripts', 'size-enrich', '.cache')
fs.mkdirSync(CACHE_DIR, { recursive: true })

export function loadEnv() {
  const text = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#') || !l.includes('=')) continue
    const i = l.indexOf('=')
    const k = l.slice(0, i).trim()
    const v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(k in process.env)) process.env[k] = v
  }
}

export function supa() {
  loadEnv()
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async select(query) {
      const out = []
      for (let from = 0; ; from += 1000) {
        const r = await fetch(`${url}/rest/v1/${query}`, {
          headers: { ...headers, Range: `${from}-${from + 999}` },
        })
        if (!r.ok) throw new Error(`select ${r.status} ${await r.text()}`)
        const rows = await r.json()
        out.push(...rows)
        if (rows.length < 1000) break
      }
      return out
    },
    async patch(table, id, body) {
      const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`patch ${r.status} ${await r.text()}`)
    },
  }
}

export function strip(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function norm(s) {
  return strip(s)
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9%.,]+/g, ' ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[.,]+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Quantidade + unidade de tamanho (volume/peso). "un/unidades" nao conta como tamanho.
export const SIZE_RE = /(?<![\w.,])(\d{1,4}(?:[.,]\d{1,2})?)\s*(ml|mililitros?|gr|gramas?|g|kg|mg|l|litros?|oz)(?![a-z0-9'’])/gi

export function normUnit(u) {
  u = u.toLowerCase()
  if (u.startsWith('mililit')) return 'ML'
  if (u === 'ml') return 'ML'
  if (u === 'g' || u === 'gr' || u.startsWith('gram')) return 'G'
  if (u === 'kg') return 'KG'
  if (u === 'mg') return 'MG'
  if (u === 'l' || u.startsWith('litro')) return 'L'
  if (u === 'oz') return 'OZ'
  return u.toUpperCase()
}

export function fmtQty(q) {
  const n = parseFloat(String(q).replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}

export function sizeKey(label) {
  // "240 ML" -> "240ml"; comparacao numerica
  // Chave canônica: ML/L -> ml ; G/KG/MG -> g (1 L == 1000 ML)
  const m = /^(\d+(?:[.,]\d+)?)\s*([A-Z]+)$/.exec(label || '')
  if (!m) return null
  let n = parseFloat(m[1].replace(',', '.'))
  let u = m[2].toLowerCase()
  if (u === 'l') (n *= 1000), (u = 'ml')
  if (u === 'kg') (n *= 1000), (u = 'g')
  if (u === 'mg') (n /= 1000), (u = 'g')
  return `${Math.round(n * 1000) / 1000}${u}`
}

/** Todos os tamanhos distintos encontrados em um texto. */
export function findSizes(text) {
  const out = []
  const seen = new Set()
  if (!text) return out
  SIZE_RE.lastIndex = 0
  for (const m of text.matchAll(SIZE_RE)) {
    const qty = fmtQty(m[1])
    if (!qty || parseFloat(qty.replace(',', '.')) === 0) continue
    const label = `${qty} ${normUnit(m[2])}`
    const k = sizeKey(label)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ label, index: m.index })
  }
  return out
}

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function getJson(url, retries = 3) {
  let last
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      })
      if (r.status === 429) {
        await sleep(3000 * (i + 1))
        continue
      }
      if (r.status === 404 || r.status === 204) return null
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const t = await r.text()
      return t ? JSON.parse(t) : null
    } catch (e) {
      last = e
      await sleep(1000 * (i + 1))
    }
  }
  throw last
}

export function readCache(name, fallback) {
  const f = path.join(CACHE_DIR, name)
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback
}
export function writeCache(name, data) {
  fs.writeFileSync(path.join(CACHE_DIR, name), JSON.stringify(data, null, 1))
}

// ---------- Comparação estrita de nomes (mesmo produto exato) ----------
const STOPW = new Set('de da do das dos e com para em o a os as um uma the by'.split(' '))
export const tokens = (s) => norm(s).split(' ').filter((t) => t && !STOPW.has(t))
// Palavras que indicam OUTRO produto/formato quando aparecem só de um lado.
const DISCRIMINATORS = new Set(
  'refil refill kit mini travel trio duo combo sache recarga spray mousse espuma'.split(' ')
)
/**
 * c: candidato { productName, brand }. Retorna true se for o mesmo produto:
 * - todas as palavras do nosso nome (fora a marca) estão no candidato;
 * - o candidato não tem mais de 2 palavras a mais, e nenhuma delas é "discriminadora"
 *   (refil, kit, spray, tipo de produto diferente etc.).
 */
export function sameProductName(p, c) {
  const mine = new Set(tokens(p.name))
  const myBrand = new Set(tokens(p.brand || ''))
  const cand = new Set(tokens(c.productName))
  const candBrand = new Set(tokens(c.brand || ''))
  const bt = [...myBrand].filter((t) => t.length > 2)
  const brandHits = bt.filter((t) => cand.has(t) || candBrand.has(t)).length
  const brandOk = bt.length === 0 || brandHits >= Math.ceil(bt.length / 2)
  if (!brandOk) return false
  for (const t of mine) {
    if (cand.has(t) || myBrand.has(t) || candBrand.has(t)) continue
    return false
  }
  const extra = [...cand].filter((t) => !mine.has(t) && !myBrand.has(t) && !candBrand.has(t) && !/^\d/.test(t))
  if (extra.length > 2) return false
  if (extra.some((t) => DISCRIMINATORS.has(t))) return false
  return true
}

// ---------- Tipo de produto (shampoo, máscara, tônico...) ----------
// Se os dois nomes têm tipos conhecidos e eles não se cruzam, o EAN/nome é suspeito.
const TYPE_GROUPS = [
  ['shampoo'],
  ['condicionador', 'conditioner'],
  ['mascara', 'masque', 'mask'],
  ['leave', 'finalizador', 'spray', 'bruma', 'mist', 'laque', 'fixador'],
  ['oleo', 'oil'],
  ['serum', 'ampola'],
  ['creme', 'hidratante', 'gel', 'balsamo', 'locao', 'cream'],
  ['tonico', 'toner', 'agua'],
  ['sabonete', 'limpeza', 'cleansing', 'demaquilante', 'esfoliante'],
  ['protetor', 'fps', 'solar'],
  ['batom', 'gloss', 'labial'],
  ['base', 'corretivo', 'po', 'blush', 'sombra', 'delineador', 'rimel'],
]
export const typesOf = (s) => {
  const t = new Set(tokens(s))
  return TYPE_GROUPS.map((g, i) => (g.some((w) => t.has(w)) ? i : -1)).filter((i) => i >= 0)
}
export const typeCompatible = (a, b) => {
  const ta = typesOf(a)
  const tb = typesOf(b)
  if (!ta.length || !tb.length) return true
  return ta.some((x) => tb.includes(x))
}
