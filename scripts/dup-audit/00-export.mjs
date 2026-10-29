import { supa } from '../size-enrich/lib.mjs'
import fs from 'node:fs'
const db = supa()
const rows = await db.select('products?select=id,name,slug,description,price,original_price,stock,images,active,created_at,sku,gtin,product_type,parent_id,size_label,woocommerce_id,brand:brands(name),category:categories!products_category_id_fkey(name)&order=name.asc')
fs.writeFileSync('scripts/dup-audit/all.json', JSON.stringify(rows))
const c = (f)=>rows.reduce((m,r)=>(m[f(r)]=(m[f(r)]||0)+1,m),{})
console.log(rows.length, c(r=>`${r.product_type}|active=${r.active}|parent=${!!r.parent_id}`))
console.log('gtin', rows.filter(r=>r.gtin).length, 'sku', rows.filter(r=>r.sku).length)

