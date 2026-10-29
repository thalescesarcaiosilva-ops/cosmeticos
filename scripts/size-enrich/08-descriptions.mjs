// Monta descrições boas (HTML limpo) para produtos sem tamanho original e com descrição "crua" (uma linha).
// Fonte: o MESMO produto exato em lojas públicas (EAN igual, ou nome praticamente idêntico).
import { readCache, writeCache, norm, findSizes, sizeKey, sameProductName, typeCompatible } from './lib.mjs'

const products = readCache('products.json', [])
const resolved = Object.fromEntries(readCache('resolved.json', []).map((r) => [r.id, r]))
const epoca = readCache('epoca.json', {})
const vtexExtra = readCache('vtex-extra.json', {})

const plain = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const isCrude = (p) => plain(p.description).length < 200
const STOP = new Set('de da do das dos e com para em o a os as um uma the by'.split(' '))
const tok = (s) => norm(s).split(' ').filter((t) => t && !STOP.has(t))
const digits = (g) => String(g || '').replace(/\D/g, '').replace(/^0+/, '')

// ---------------- sanitização ----------------
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ccedil: 'ç', Ccedil: 'Ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à', acirc: 'â', ecirc: 'ê', ocirc: 'ô', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Atilde: 'Ã', Otilde: 'Õ', ordm: 'º', ordf: 'ª', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', reg: '®', trade: '™', deg: '°' }
function decode(s) {
  return s
    .replace(/&#(\d{2,5});?/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENT ? ENT[n] : m))
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BANNED =
  /\b(época|epoca|beleza na web|belezanaweb|amobeleza|drogasil|raia|pague menos|drogaria|farm[áa]cia|frete|cupom|parcel\w*|em até \d+x|r\$\s?\d|compre (agora|já)|nosso site|nossa loja|garantia de|mercado livre|whatsapp|clique aqui|ver mais|leia mais|lojas? oficiais?|somos (a|o|uma?)\b.*|nosso compromisso|melhores vendedores|estamos sempre|seu conforto|servir e ajudar|butique|vendedor|nossos? clientes?|envio (imediato|d[aeo])|o envio|pronta entrega|prazo de entrega|nota fiscal|produto original|n[óo]s d[aeo]s? loja|informamos|aleat[óo]ri[oa]|cosm[ée]ticos? ltda)\b/i

function toBlocks(html, product) {
  let s = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<(strong|b)\b[^>]*>/gi, '\u0001')
    .replace(/<\/(strong|b)>/gi, '\u0002')
    .replace(/<(em|i)\b[^>]*>/gi, '\u0003')
    .replace(/<\/(em|i)>/gi, '\u0004')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section)>/gi, '\n')
    .replace(/<(p|div|ul|ol|h[1-6]|tr|table|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  s = decode(decode(s)).replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\u00a0/g, ' ')
  const lines = s.split(/\n+/).map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
  const brandWords = new Set(tok(product.name + ' ' + (product.brand || '')))
  const out = []
  for (let line of lines) {
    const text = line.replace(/[\u0001-\u0004]/g, '').trim()
    if (!text || text.length < 2) continue
    if ((text.match(/\|/g) || []).length >= 2) continue // faixas de vendedor: "ENVIO IMEDIATO | NOTA FISCAL | ..."
    // ignora linhas que falam de outras lojas/preços (a menos que a palavra faça parte do nome do produto)
    const m = BANNED.exec(text)
    if (m && !brandWords.has(norm(m[0]).split(' ')[0])) continue
    out.push(line)
  }
  return out
}

function renderHtml(lines, product, ourTitleTokens) {
  const blocks = []
  const isBullet = (l) => /^(\u0001|\u0003)*\s*[•\-*–·]\s+/.test(l)
  const stripMarks = (l) => l.replace(/[\u0001-\u0004]/g, '').trim()
  const inline = (l) =>
    esc(l)
      .replace(/\u0001/g, '<strong>')
      .replace(/\u0002/g, '</strong>')
      .replace(/\u0003/g, '<em>')
      .replace(/\u0004/g, '</em>')
      .replace(/<strong>\s*<\/strong>/g, '')
      .replace(/<em>\s*<\/em>/g, '')
  const closeTags = (h) => {
    // garante tags balanceadas
    let st = (h.match(/<strong>/g) || []).length - (h.match(/<\/strong>/g) || []).length
    let em = (h.match(/<em>/g) || []).length - (h.match(/<\/em>/g) || []).length
    while (st-- > 0) h += '</strong>'
    while (em-- > 0) h += '</em>'
    return h
  }
  let i = 0
  let first = true
  while (i < lines.length) {
    const line = lines[i]
    const text = stripMarks(line)
    // título repetido no começo
    if (first) {
      first = false
      const t = new Set(tok(text))
      const overlap = [...t].filter((x) => ourTitleTokens.has(x)).length
      if (text.length < 140 && t.size && overlap / t.size >= 0.7 && !/[.!]$/.test(text)) {
        i++
        continue
      }
    }
    if (isBullet(line)) {
      const items = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(closeTags(inline(lines[i].replace(/^(\u0001|\u0003)*\s*[•\-*–·]\s+/, ''))))
        i++
      }
      blocks.push('<ul>' + items.map((x) => `<li>${x}</li>`).join('') + '</ul>')
      continue
    }
    const wrapped = /^\u0001[^\u0001\u0002]+\u0002\s*:?\s*$/.test(line)
    if ((wrapped || /^[A-ZÀ-Ú][^.!]{2,80}[?:]$/.test(text)) && text.length <= 100 && !/\.$/.test(text)) {
      blocks.push(`<h3>${esc(text.replace(/:$/, ''))}</h3>`)
      i++
      continue
    }
    // sequência de linhas "Chave: valor" curtas viram lista
    if (/^[^:.]{2,40}:\s+\S/.test(text) && text.length <= 140) {
      const items = []
      while (i < lines.length) {
        const t = stripMarks(lines[i])
        if (!/^[^:.]{2,40}:\s+\S/.test(t) || t.length > 140 || isBullet(lines[i])) break
        items.push(closeTags(inline(lines[i])))
        i++
      }
      if (items.length >= 2) blocks.push('<ul>' + items.map((x) => `<li>${x}</li>`).join('') + '</ul>')
      else blocks.push(`<p>${items[0]}</p>`)
      continue
    }
    blocks.push(`<p>${closeTags(inline(line))}</p>`)
    i++
  }
  return blocks.join('\n')
}

// ---------------- seleção da fonte ----------------
const results = {}
const stats = {}
const bump = (k) => (stats[k] = (stats[k] || 0) + 1)

for (const p of products) {
  if (p.nameSizes.length > 0 || !isCrude(p)) continue
  const r = resolved[p.id]
  const mine = new Set(tok(p.name))
  const brand = new Set(tok(p.brand || ''))
  const candidates = []

  const E = epoca[p.id]
  const g = digits(p.gtin)
  // 1) EAN exato (somente quando a verificação de tamanho/tipo não acusou conflito)
  if (E?.byEan?.description && g && E.byEan.items.some((i) => digits(i.ean) === g)) {
    const okSource = r && /ean/.test(r.source || '')
    const sizeUnknown = !r || !r.size
    const overlap = [...mine].filter((t) => tok(E.byEan.productName).includes(t) || brand.has(t)).length / (mine.size || 1)
    if (okSource || (sizeUnknown && !['conflict', 'ean-type-mismatch'].includes(r?.source) && overlap >= 0.6))
      candidates.push({ html: E.byEan.description, from: 'epoca-ean', name: E.byEan.productName })
  }
  // 2) EAN exato em outras lojas VTEX
  if (g && vtexExtra[p.id]) {
    for (const [store, c] of Object.entries(vtexExtra[p.id])) {
      if (c && typeof c === 'object' && c.description && c.items?.some((i) => digits(i.ean) === g) && r && /ean/.test(r.source || ''))
        candidates.push({ html: c.description, from: 'vtex-ean:' + store, name: c.productName })
    }
  }
  // 3) busca por texto na Época com nome praticamente idêntico (e tamanho compatível, se conhecido)
  if (!candidates.length && E?.byText?.length) {
    for (const c of E.byText) {
      if (!c.description) continue
      if (!sameProductName(p, c)) continue
      if (r?.size) {
        const want = sizeKey(r.size)
        const has = c.items.some((it) => {
          const s = findSizes(`${it.name} ${it.nameComplete}`)
          return s.some((x) => sizeKey(x.label) === want)
        })
        if (!has) continue
      }
      candidates.push({ html: c.description, from: 'epoca-text', name: c.productName })
    }
  }
  const usable = candidates.filter((c) => typeCompatible(p.name, c.name || ''))
  if (candidates.length && !usable.length) bump('tipo-incompativel')
  if (!usable.length) {
    bump('sem-fonte')
    continue
  }

  let best = null
  for (const c of usable) {
    const lines = toBlocks(c.html, p)
    const html = renderHtml(lines, p, mine)
    const len = plain(html).length
    if (!best || len > best.len) best = { ...c, html, len }
  }
  if (!best || best.len < 250) {
    bump('fonte-curta')
    continue
  }
  if (best.html.length > 9000) {
    // corta em um limite de bloco
    const parts = best.html.split('\n')
    let acc = ''
    for (const part of parts) {
      if ((acc + part).length > 8500) break
      acc += (acc ? '\n' : '') + part
    }
    best.html = acc
  }
  results[p.id] = { id: p.id, name: p.name, slug: p.slug, from: best.from, fromName: best.name, html: best.html }
  bump(best.from)
}

// ---------------- override: Glycolic The Ordinary (texto indicado pelo cliente) ----------------
const GLYCOLIC_SLUG = 'tonico-esfoliante-iluminador-the-ordinary-glycolic-acid-7'
const glyc = products.find((p) => p.slug === GLYCOLIC_SLUG)
if (glyc) {
  const html = [
    '<p>O Tônico Esfoliante com Ácido Glicólico 7% The Ordinary é um produto à base de água e fórmula tecnológica que promove a renovação celular da pele, revelando uma aparência mais luminosa, uniforme e saudável.</p>',
    '<h3>Benefícios do tônico esfoliante com ácido glicólico 7% The Ordinary</h3>',
    '<p>O Tônico com Ácido Glicólico da The Ordinary é formulado para quem busca revitalizar a pele com eficácia e suavidade. Veja seus principais benefícios!</p>',
    '<ul><li>Estimula a renovação celular com uma pele mais lisa e radiante;</li><li>Uniformiza o tom da pele, auxiliando na redução de manchas e marcas de acne;</li><li>Diminui a aparência dos poros dilatados e melhora a textura;</li><li>Suaviza linhas finas e proporciona toque macio;</li><li>Melhora a luminosidade natural da pele, deixando-a mais viçosa;</li><li>Pode ser usado nos cabelos, selando as cutículas e restaurando o brilho dos fios.</li></ul>',
    '<p>Além disso, ele atua como um esfoliante químico que renova, ilumina e refina a textura da pele.</p>',
    '<h3>Como o ácido glicólico atua na pele?</h3>',
    '<p>O ácido glicólico é um AHA (alfa-hidroxiácido) conhecido por sua capacidade de penetrar profundamente nas camadas da pele.</p>',
    '<p>Ele age dissolvendo as ligações entre as células mortas, promovendo uma esfoliação química delicada, sem a necessidade de fricção.</p>',
    '<p>Com isso, a superfície da pele é renovada gradualmente, revelando uma textura mais uniforme e um aspecto revitalizado. O resultado é uma pele que respira, reflete luz e recupera o equilíbrio natural da hidratação.</p>',
    '<h3>Em quanto tempo o ácido glicólico começa a fazer efeito?</h3>',
    '<p>Os resultados do ácido glicólico variam conforme o tipo de pele e a rotina de cuidados. No entanto, muitas pessoas notam melhora na luminosidade e na textura já nas primeiras 3 semanas de uso contínuo.</p>',
    '<p>O segredo está na constância, já que o uso regular do tônico potencializa seus efeitos e mantém a pele em constante processo de renovação.</p>',
    '<h3>Para quem o tônico com ácido glicólico The Ordinary é indicado?</h3>',
    '<p>O tônico esfoliante da The Ordinary é indicado para diferentes tipos e necessidades de pele.</p>',
    '<ul><li><strong>Pele mista a oleosa:</strong> controla o excesso de brilho e desobstrui os poros;</li><li><strong>Pele acneica:</strong> atua como esfoliante químico para acne, auxiliando na prevenção de novas imperfeições;</li><li><strong>Pele madura:</strong> estimula a renovação celular, suavizando linhas e proporcionando firmeza;</li><li><strong>Pele com manchas:</strong> contribui para o clareamento gradual e para a uniformização do tom.</li></ul>',
    '<p>Por conter ácido glicólico, é essencial consultar um dermatologista para entender o melhor momento e frequência de uso, garantindo resultados seguros e eficazes.</p>',
    '<h3>Quando usar o ácido glicólico 7% The Ordinary?</h3>',
    '<p>Recomenda-se aplicar o Tônico com Ácido Glicólico uma vez ao dia, preferencialmente à noite, após a limpeza facial.</p>',
    '<p>Pela manhã, o uso de protetor solar é indispensável, já que o ácido glicólico pode deixar a pele mais sensível à luz solar.</p>',
    '<p>Evite combinar o produto com outros ácidos na mesma rotina, a fim de preservar o equilíbrio cutâneo.</p>',
    '<h3>Revitalize sua pele com o tônico de ácido glicólico The Ordinary</h3>',
    '<p>O tônico da The Ordinary reflete o compromisso de um produto com fórmula transparente, eficaz e acessível, sendo um verdadeiro aliado da rotina noturna de skincare para quem busca luminosidade, textura uniforme e frescor.</p>',
  ].join('\n')
  results[glyc.id] = { id: glyc.id, name: glyc.name, slug: glyc.slug, from: 'sephora (texto fornecido)', fromName: glyc.name, html }
  bump('manual-sephora')
}

writeCache('descriptions.json', results)
console.log(stats, 'total com nova descrição:', Object.keys(results).length)
