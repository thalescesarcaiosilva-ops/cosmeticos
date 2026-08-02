const fs = require('fs')

const THRESHOLD = 150
const CONCURRENCY = 6
const MATCH_PATH = 'tmp-catalog-epoca-match.json'
const OUT_PATH = 'tmp-epoca-reviews-audit.json'

function extractCount(html) {
  // "rates":{"product_code":"...","average":4.7,"count":7052
  const m = html.match(/"rates"\s*:\s*\{[^}]*"count"\s*:\s*(\d+)/)
  if (m) return Number(m[1])
  const m2 = html.match(/"count"\s*:\s*(\d+)[^}]*"average"\s*:\s*([\d.]+)/)
  if (m2) return Number(m2[1])
  return null
}

async function fetchCount(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  })
  if (!res.ok) return { ok: false, status: res.status, count: null }
  const html = await res.text()
  return { ok: true, status: res.status, count: extractCount(html) }
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

async function main() {
  const { matched } = JSON.parse(fs.readFileSync(MATCH_PATH, 'utf8'))
  const nonPerfume = matched.filter((m) => !m.store.isPerfume)
  console.log('nonPerfume to check', nonPerfume.length)

  let done = 0
  const rows = await mapPool(nonPerfume, CONCURRENCY, async (item) => {
    const url = item.epoca.url
    let attempt = 0
    let result = { ok: false, status: 0, count: null }
    while (attempt < 3) {
      attempt++
      try {
        result = await fetchCount(url)
        if (result.ok) break
      } catch (e) {
        result = { ok: false, status: 0, count: null, error: e.message }
      }
      await new Promise((r) => setTimeout(r, 400 * attempt))
    }
    done++
    if (done % 25 === 0 || done === nonPerfume.length) {
      console.log(`progress ${done}/${nonPerfume.length}`)
    }
    return {
      id: item.store.id,
      name: item.store.name,
      slug: item.store.slug,
      cats: item.store.cats.map((c) => c.slug),
      epocaUrl: url,
      epocaId: item.epoca.product_id,
      reviewCount: result.count,
      fetchOk: result.ok,
      status: result.status,
      keep: result.count != null && result.count >= THRESHOLD,
    }
  })

  const keep = rows.filter((r) => r.keep)
  const removeLow = rows.filter((r) => r.fetchOk && r.reviewCount != null && r.reviewCount < THRESHOLD)
  const unknown = rows.filter((r) => !r.fetchOk || r.reviewCount == null)

  const summary = {
    threshold: THRESHOLD,
    checked: rows.length,
    keepGte150: keep.length,
    removeBelow150: removeLow.length,
    unknownReview: unknown.length,
    byCategoryRemove: {},
    byCategoryKeep: {},
  }
  for (const r of removeLow) {
    for (const c of r.cats) summary.byCategoryRemove[c] = (summary.byCategoryRemove[c] || 0) + 1
  }
  for (const r of keep) {
    for (const c of r.cats) summary.byCategoryKeep[c] = (summary.byCategoryKeep[c] || 0) + 1
  }

  const out = { summary, keep, removeLow, unknown, generatedAt: new Date().toISOString() }
  fs.writeFileSync(OUT_PATH, JSON.stringify(out))
  console.log(JSON.stringify(summary, null, 2))
  console.log('wrote', OUT_PATH)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
