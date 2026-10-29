// Para produtos sem tamanho no nome: procura tamanho na descrição atual e mostra o contexto para revisão.
import { readCache, findSizes } from './lib.mjs'

const products = readCache('products.json', [])
const noName = products.filter((p) => p.nameSizes.length === 0)
console.log('sem tamanho no nome:', noName.length)

let n = 0
for (const p of noName) {
  const sizes = findSizes(p.description)
  if (!sizes.length) continue
  n++
  const ctx = sizes
    .slice(0, 4)
    .map((s) => `[${s.label}] ...${p.description.slice(Math.max(0, s.index - 50), s.index + 25).replace(/\s+/g, ' ')}`)
  console.log(`\n# ${p.name}\n  ${ctx.join('\n  ')}`)
}
console.log('\ncom tamanho na descrição:', n)
