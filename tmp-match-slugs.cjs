const fs = require('fs')

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const catalog = JSON.parse(fs.readFileSync('tmp-catalog-audit.json', 'utf8'))
const raw = JSON.parse(
  fs.readFileSync(
    'c:/importarprodutos/exportados/epoca_cosmeticos_1000_20260713_152010_raw.json',
    'utf8'
  )
)

const rawByLink = new Map()
const rawByName = new Map()
for (const r of raw) {
  const link = norm((r.url || '').replace(/https?:\/\/[^/]+\//, '').replace(/\/p\/?$/, ''))
  rawByLink.set(link, r)
  rawByName.set(norm(r.nome), r)
}

let bySlug = 0
let byName = 0
let none = 0
const matched = []
const unmatched = []

for (const p of [...catalog.keepPool, ...catalog.perfume]) {
  const slug = norm(p.slug)
  let r = rawByLink.get(slug)
  let how = 'slug'
  if (!r) {
    // try without trailing size tokens differences
    r = rawByName.get(norm(p.name))
    how = 'name'
  }
  if (!r) {
    // fuzzy: raw link includes store slug or vice-versa
    for (const [link, item] of rawByLink) {
      if (link.includes(slug) || slug.includes(link)) {
        r = item
        how = 'partial'
        break
      }
    }
  }
  if (r) {
    if (how === 'slug') bySlug++
    else if (how === 'name') byName++
    matched.push({ store: p, epoca: r, how })
  } else {
    none++
    unmatched.push(p)
  }
}

console.log({
  totalStore: catalog.keepPool.length + catalog.perfume.length,
  matched: matched.length,
  bySlug,
  byName,
  unmatched: none,
  unmatchedSample: unmatched.slice(0, 5).map((p) => ({ name: p.name, slug: p.slug })),
})

fs.writeFileSync(
  'tmp-catalog-epoca-match.json',
  JSON.stringify({ matched, unmatched }, null, 0)
)
