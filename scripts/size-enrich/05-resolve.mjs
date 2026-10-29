// Cruza evidências (nome, descrição revisada, Lunna, Época, outras VTEX) e decide o tamanho de cada produto.
// Regra de ouro: só aceita quando é o MESMO produto exato (EAN igual + corroboração, ou mesmo slug com variante única).
import { readCache, writeCache, findSizes, sizeKey, norm, sameProductName, typeCompatible } from './lib.mjs'

const products = readCache('products.json', [])
const lunna = readCache('lunna.json', {})
const epoca = readCache('epoca.json', {})
const vtexExtra = readCache('vtex-extra.json', {})

// Revisados manualmente: o tamanho aparece na descrição do PRÓPRIO produto.
const DESC_OK = new Map(
  Object.entries({
    'Condicionador Vichy Dercos Antiqueda Energy+': '200 ML',
    'Creme Hidratante NIVEA Lata': '97 G',
    'Dercos Shampoo Anticaspa Intensivo Ds Cabelos Secos': '300 G',
    'Gloss Glossip Girl – Fran by Franciny Ehlke': '4,5 ML',
    'Henna Pó Surya Castanho': '50 G',
    'Leave-in Revlon Professional Uniq One150ml': '150 ML',
    'Liftactiv Sérum H.A. Epidermic Filler': '30 ML',
    'Protetor Solar com Cor Dermage – Photoage Stick Color FPS99 Claro': '12 G',
    'Protetor Solar com Cor Dermage – Photoage Stick Color FPS99 Médio': '12 G',
    'Protetor Solar com Cor Dermage – Photoage Stick Color FPS99 Médio Intense': '12 G',
    'Protetor Solar Facial Para Pele Oleosa Neutrogena Sun Fresh Derm Care FPS70 Clara': '40 G',
    'Protetor Solar Facial Para Pele Oleosa Neutrogena Sun Fresh Derm Care FPS70 Morena': '40 G',
    'Protetor Solar Facial Para Pele Oleosa Neutrogena Sun Fresh Derm Care FPS70 Negra': '40 G',
    'Protetor Solar Skinceuticals - UV Oil Defense FPS 80 Tinted Universal': '40 G',
    'Protetor Solar Vichy Idéal Soleil Corporal Hydra Soft FPS30': '200 ML',
    'Protetor Solar Vichy Idéal Soleil Corporal HydraSoft FPS70': '200 ML',
    'Refil Sabonete Líquido Granado Tradicional': '300 ML',
  })
)
// Pink Cheeks Pro Stick: descrição cita "Pink Stick 14g" para todas as variações de FPS90.
for (const p of products) if (/^Protetor Solar Facial Com Cor Pink Stick FPS90/.test(p.name)) DESC_OK.set(p.name, '14 G')

const isKit = (name) => /\bkit\b|\bcombo\b|\btrio\b|\bunidades?\b|\b\d+\s*x\s*\d/i.test(name)
const STOP = new Set('de da do das dos e com para em o a os as um uma the by'.split(' '))
const tok = (s) => norm(s).split(' ').filter((t) => t && !STOP.has(t))
const digits = (g) => String(g || '').replace(/\D/g, '').replace(/^0+/, '')
const keyOf = (label) => sizeKey(findSizes(label || '')[0]?.label)

function itemSize(it) {
  for (const src of [it.name, it.tamanho, it.nameComplete]) {
    const s = findSizes(src || '')
    if (s.length === 1) return s[0].label
    if (s.length > 1 && src !== it.nameComplete) return null
  }
  return null
}

const results = []
for (const p of products) {
  const r = { id: p.id, name: p.name, slug: p.slug, size: null, source: null, confidence: null, notes: [] }
  results.push(r)

  if (p.nameSizes.length === 1) {
    Object.assign(r, { size: p.nameSizes[0], source: 'name', confidence: 'high' })
    continue
  }
  if (p.nameSizes.length > 1) {
    r.source = 'kit-multiple-sizes'
    continue
  }
  if (DESC_OK.has(p.name)) {
    Object.assign(r, { size: DESC_OK.get(p.name), source: 'description', confidence: 'high' })
    continue
  }
  if (isKit(p.name)) {
    r.source = 'kit-skip'
    continue
  }

  const g = digits(p.gtin)

  // ---------- Lunna (mesmo slug; variantes com GTIN) ----------
  const L = lunna[p.slug]
  const lVariants = L?.status === 200 ? (L.variants || []).filter((v) => v.size) : []
  const lKeys = new Set(
    [...lVariants.map((v) => keyOf(v.size)), keyOf(L?.titleSize)].filter(Boolean)
  )
  let lExactSize = null // nosso GTIN aparece na Lunna -> variante exata
  let lSingleSize = null // Lunna tem uma única variante para este slug
  if (L?.status === 200) {
    const hit = g ? lVariants.find((v) => digits(v.gtin) === g) : null
    if (hit) lExactSize = findSizes(hit.size)[0]?.label || null
    else if (g && digits(L.mainGtin) === g && L.titleSize) lExactSize = findSizes(L.titleSize)[0]?.label || null
    if (!lExactSize && lKeys.size === 1) {
      const raw = L.titleSize || lVariants[0]?.size
      lSingleSize = findSizes(raw)[0]?.label || null
      // com GTIN divergente, a Lunna pode estar falando de outra variação -> não usar sozinha
      const lg = [L.mainGtin, ...lVariants.map((v) => v.gtin)].map(digits).filter(Boolean)
      if (g && lg.length && !lg.includes(g)) {
        r.notes.push('lunna-gtin-differs:' + lSingleSize)
        lSingleSize = null
      }
    }
    if (!lExactSize && !lSingleSize && lKeys.size > 1) r.notes.push('lunna-multi:' + [...lKeys].join('|'))
  }

  // ---------- Época / VTEX (EAN exato) ----------
  const E = epoca[p.id]
  let eExact = null
  let eSrc = null
  let eProductName = null
  if (E?.byEan) {
    const it = E.byEan.items.find((i) => digits(i.ean) === g)
    const s = it ? itemSize(it) : null
    if (s) {
      eExact = s
      eSrc = 'epoca-ean'
      eProductName = E.byEan.productName
    }
  }
  if (!eExact && g && vtexExtra[p.id]) {
    for (const [store, c] of Object.entries(vtexExtra[p.id])) {
      if (!c || typeof c !== 'object' || !c.items) continue
      const it = c.items.find((i) => digits(i.ean) === g)
      const s = it ? itemSize(it) || itemSize({ name: c.productName }) : null
      if (s) {
        eExact = s
        eSrc = 'vtex-ean:' + store
        eProductName = c.productName
        break
      }
    }
  }

  // ---------- Época (busca por texto, nome bem parecido) ----------
  let eText = null
  let eTextMulti = null
  if (!eExact && E?.byText?.length) {
    const sizes = new Map()
    for (const c of E.byText) {
      if (!sameProductName(p, c)) continue
      for (const it of c.items) {
        const s = itemSize(it)
        if (s) sizes.set(sizeKey(s), s)
      }
    }
    if (sizes.size === 1) eText = [...sizes.values()][0]
    else if (sizes.size > 1) {
      eTextMulti = new Set(sizes.keys())
      r.notes.push('epoca-text-multi:' + [...sizes.values()].join('|'))
    }
  }

  const accept = (size, source, confidence) => Object.assign(r, { size, source, confidence })
  const ek = eExact && keyOf(eExact)

  if (eExact) {
    const typeOk = typeCompatible(p.name, eProductName || '')
    if (lExactSize && keyOf(lExactSize) !== ek) {
      r.source = 'conflict'
      r.notes.push(`epoca-ean=${eExact} lunna-gtin=${lExactSize}`)
    } else if (lExactSize) {
      accept(eExact, eSrc + '+lunna-gtin', 'high')
    } else if (lKeys.size && !lKeys.has(ek)) {
      r.source = 'conflict'
      r.notes.push(`epoca-ean=${eExact} lunna-sizes=${[...lKeys].join('|')}`)
    } else if (lKeys.size && lKeys.has(ek)) {
      accept(eExact, eSrc + '+lunna', typeOk ? 'high' : 'medium')
    } else if (typeOk) {
      accept(eExact, eSrc, 'high')
    } else {
      r.source = 'ean-type-mismatch'
      r.notes.push(`${eExact} <- ${eProductName}`)
    }
  } else if (lExactSize) {
    accept(lExactSize, 'lunna-gtin', 'high')
  } else if (lSingleSize && eText && keyOf(lSingleSize) !== keyOf(eText)) {
    r.source = 'conflict'
    r.notes.push(`lunna=${lSingleSize} epoca-text=${eText}`)
  } else if (lSingleSize && eTextMulti && !eTextMulti.has(keyOf(lSingleSize))) {
    r.source = 'conflict'
    r.notes.push(`lunna=${lSingleSize} not in epoca-text-multi`)
  } else if (lSingleSize && eText) {
    accept(lSingleSize, 'lunna+epoca-text', 'high')
  } else if (lSingleSize) {
    accept(lSingleSize, 'lunna-single', g ? 'medium' : 'medium-nogtin')
  } else if (eText) {
    accept(eText, 'epoca-text', 'medium')
  } else {
    r.source = 'unresolved'
  }
}

// Sanidade: sem tamanho para ferramentas/eletrônicos e sem unidade MG.
const NO_SIZE = /\b(modelador|chapinha|prancha|secador|escova|cortador|aparador|bateria|lapiseira|esponja|pincel|curvador|curvex|alicate)\b/i
for (const r of results) {
  if (!r.size || r.source === 'name') continue
  if (NO_SIZE.test(r.name) || /MG$/.test(r.size)) {
    r.notes.push('dropped:' + r.size)
    Object.assign(r, { size: null, source: 'dropped-sanity', confidence: null })
  }
}

writeCache('resolved.json', results)
const by = {}
for (const r of results) {
  const k = `${r.source}${r.confidence ? ':' + r.confidence : ''}`
  by[k] = (by[k] || 0) + 1
}
console.log(by)
console.log('com tamanho:', results.filter((r) => r.size).length, '/', results.length)
