const fs = require('fs')

const html = fs.readFileSync('tmp-epoca-sample.html', 'utf8')
const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
const j = JSON.parse(next[1])
const s = JSON.stringify(j)
const keys = [
  'totalRated',
  'ratingCount',
  'reviewCount',
  'totalReviews',
  'average',
  'stars',
  'Trustvox',
  'trustvox',
  'yourviews',
  'avaliacao',
  'Avalia',
  'opinions',
  'Opinions',
]
for (const k of keys) {
  const i = s.indexOf(k)
  console.log(k, i)
  if (i >= 0) console.log(s.slice(Math.max(0, i - 40), i + 140))
}

// Find possible review widget config
for (const needle of ['trustvox', 'yourviews', 'avalia.se', 'rakuten', 'yotpo', 'reviews-and-ratings']) {
  const re = new RegExp(needle, 'gi')
  const m = [...html.matchAll(re)].slice(0, 5)
  console.log(needle, m.length, m.map((x) => x[0]))
}

// Dump scripts src containing review
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1])
console.log(
  'review-ish scripts',
  scripts.filter((u) => /review|trust|rating|avalia|opinion/i.test(u)).slice(0, 20)
)
