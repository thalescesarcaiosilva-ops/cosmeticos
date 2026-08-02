const fs = require('fs')

const THRESHOLD = 150
const CONCURRENCY = 6
const MATCH_PATH = 'tmp-catalog-epoca-match.json'
const OUT_PATH = 'tmp-perfume-mf-reviews.json'

function extractCount(html) {
  const m = html.match(/"rates"\s*:\s*\{[^}]*"count"\s*:\s*(\d+)/)
  if (m) return Number(m[1])
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
  const perfumeMf = matched.filter((m) => {
    const slugs = (m.store.cats || []).map((c) => c.slug)
    return (
      slugs.includes('perfumes-femininos') ||
      slugs.includes('perfumes-masculinos')
    ) && !slugs.includes('perfumes') // generic handled separately
  })

  // Also include if only in masc/fem (all perfume unique were disjoint)
  const perfumeOnlyGeneric = matched.filter((m) => {
    const slugs = (m.store.cats || []).map((c) => c.slug)
    return slugs.includes('perfumes')
  })

  console.log({
    perfumeMf: perfumeMf.length,
    perfumeGeneric: perfumeOnlyGeneric.length,
  })

  let done = 0
  const rows = await mapPool(perfumeMf, CONCURRENCY, async (item) => {
    let result = { ok: false, status: 0, count: null }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await fetchCount(item.epoca.url)
        if (result.ok) break
      } catch (e) {
        result = { ok: false, status: 0, count: null, error: e.message }
      }
      await new Promise((r) => setTimeout(r, 400 * attempt))
    }
    done++
    if (done % 20 === 0 || done === perfumeMf.length) {
      console.log(`progress ${done}/${perfumeMf.length}`)
    }
    const slugs = item.store.cats.map((c) => c.slug)
    return {
      id: item.store.id,
      name: item.store.name,
      slug: item.store.slug,
      cats: slugs,
      epocaUrl: item.epoca.url,
      reviewCount: result.count,
      fetchOk: result.ok,
      keep: result.count != null && result.count >= THRESHOLD,
    }
  })

  const keep = rows.filter((r) => r.keep)
  const removeLow = rows.filter(
    (r) => r.fetchOk && r.reviewCount != null && r.reviewCount < THRESHOLD
  )
  const unknown = rows.filter((r) => !r.fetchOk || r.reviewCount == null)

  const summary = {
    threshold: THRESHOLD,
    checked: rows.length,
    keepGte150: keep.length,
    removeBelow150: removeLow.length,
    unknownReview: unknown.length,
    byCatRemove: {},
    byCatKeep: {},
    genericCategoryProducts: perfumeOnlyGeneric.map((m) => ({
      id: m.store.id,
      name: m.store.name,
      slug: m.store.slug,
      cats: m.store.cats.map((c) => c.slug),
    })),
  }
  for (const r of removeLow) {
    for (const c of r.cats) summary.byCatRemove[c] = (summary.byCatRemove[c] || 0) + 1
  }
  for (const r of keep) {
    for (const c of r.cats) summary.byCatKeep[c] = (summary.byCatKeep[c] || 0) + 1
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ summary, keep, removeLow, unknown, perfumeOnlyGeneric }, null, 0)
  )
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
