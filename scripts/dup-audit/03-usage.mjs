import { supa } from '../size-enrich/lib.mjs'
import fs from 'node:fs'
const db = supa()
const seq = async (qs) => { const o = []; for (const q of qs) { for (let i=0;;i++) { try { o.push(await q); break } catch (e) { if (i>3) throw e } } } return o }
const [imgs, oi, rev, fav, views, vars, bund, pc, cats] = await seq([
  db.select('product_images?select=product_id'),
  db.select('order_items?select=product_id,quantity'),
  db.select('product_reviews?select=product_id'),
  db.select('product_favorites?select=product_id'),
  db.select('product_views_daily?select=product_id,views'),
  db.select('product_variations?select=product_id,name,active'),
  db.select('product_bundles?select=primary_product_id,companion_product_id'),
  db.select('product_categories?select=product_id,category_id'),
  db.select('categories?select=id,name,slug'),
])
const cnt = (arr, k, v) => arr.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + (v ? r[v] : 1), m), {})
const catName = Object.fromEntries(cats.map((c) => [c.id, c.name]))
const pcm = {}
for (const r of pc) (pcm[r.product_id] ||= []).push(catName[r.category_id])
const out = { images: cnt(imgs, 'product_id'), sold: cnt(oi, 'product_id', 'quantity'), reviews: cnt(rev, 'product_id'), favs: cnt(fav, 'product_id'), views: cnt(views, 'product_id', 'views'), vars: cnt(vars, 'product_id'), bundlesP: cnt(bund, 'primary_product_id'), bundlesC: cnt(bund, 'companion_product_id'), cats: pcm }
fs.writeFileSync('scripts/dup-audit/usage.json', JSON.stringify(out))
const n = (o) => Object.keys(o).length
console.log({ imgs: n(out.images), sold: n(out.sold), reviews: n(out.reviews), favs: n(out.favs), views: n(out.views), vars: n(out.vars), bundles: n(out.bundlesP) + n(out.bundlesC) })


