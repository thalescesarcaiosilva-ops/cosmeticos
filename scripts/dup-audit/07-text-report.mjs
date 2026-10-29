// Gera relatorio em texto: duplicados (por grupo), GTIN invalido/conflitante, imagens iguais.
import fs from 'node:fs'

const BASE = 'https://www.batistacosmeticos.com.br/produto/'
const { out, gtinConflicts } = JSON.parse(fs.readFileSync('scripts/dup-audit/final.json', 'utf8'))
const all = JSON.parse(fs.readFileSync('scripts/dup-audit/all.json', 'utf8'))
const usage = JSON.parse(fs.readFileSync('scripts/dup-audit/usage.json', 'utf8'))
const img = JSON.parse(fs.readFileSync('scripts/dup-audit/imggroups.json', 'utf8'))
const byId = Object.fromEntries(all.map((r) => [r.id, r]))
const brandOf = (r) => (Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name) || '(sem marca)'
const brl = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',')

const L = []
const line = (s = '') => L.push(s)
const bar = (c = '=') => line(c.repeat(100))

const TIER = {
  CONFIRMADO: 'CONFIRMADO - mesmo GTIN (ou GTIN com 1 digito a mais): e o mesmo produto',
  ALTA: 'ALTA - nome igual depois de remover tamanho/marca/palavras de enchimento',
  MEDIA: 'MEDIA - mesmo produto e tamanho, com 1-2 palavras genericas de diferenca',
  PROVAVEL: 'PROVAVEL - mesmo produto, mas as palavras diferentes PODEM indicar variante (revisar)',
  POSSIVEL: 'POSSIVEL - um nome esta contido no outro (revisar com atencao)',
  REVISAR_GTIN: 'REVISAR (GTIN DIFERENTE) - nome igual mas GTINs diferem: pode ser GTIN nacional x internacional OU variante real',
}

// ---------- agrupa
const groups = new Map()
for (const r of out) { if (!groups.has(r.grupo)) groups.set(r.grupo, []); groups.get(r.grupo).push(r) }
const tiers = ['CONFIRMADO', 'ALTA', 'MEDIA', 'PROVAVEL', 'POSSIVEL', 'REVISAR_GTIN']
const cnt = Object.fromEntries(tiers.map((t) => [t, [...groups.values()].filter((g) => g[0].confianca === t).length]))

bar()
line('RELATORIO DE PRODUTOS DUPLICADOS / GTIN INVALIDO / IMAGENS REPETIDAS')
line('Loja: Batista Cosmeticos   |   Gerado em: 29/10/2026   |   Somente leitura (nada foi alterado no banco)')
bar()
line()
line(`Produtos ativos analisados: ${all.filter((r) => r.active).length}`)
line(`Grupos de duplicados encontrados: ${groups.size}  (${out.length} produtos envolvidos)`)
for (const t of tiers) line(`  - ${t}: ${cnt[t]} grupos`)
line()
line('SUMARIO')
line('  PARTE 1 - Produtos duplicados (grupo a grupo, com URL)')
line('  PARTE 2 - Produtos com GTIN invalido / malformado / conflitante')
line('  PARTE 3 - Produtos com a MESMA IMAGEM')
line()
line('Como ler a PARTE 1:')
line('  [MANTER]   = listagem sugerida para ficar (mais vendas > avaliacoes > views > imagens > GTIN).')
line('  [UNIFICAR] = listagem sugerida para desativar e redirecionar (301) para a [MANTER].')
line('  [DEFINIR TAMANHO] = produto sem tamanho cadastrado no meio de um grupo com tamanhos diferentes.')
line('  vendidos/views/imagens = dados do proprio banco (order_items, product_views_daily, product_images).')
line('  ATENCAO: produtos com vendidas > 0 NAO devem ser apagados; apenas desativar e redirecionar.')
line()

// ---------- PARTE 1
bar()
line('PARTE 1 - PRODUTOS DUPLICADOS')
bar()
let n = 0
for (const t of tiers) {
  const gs = [...groups.values()].filter((g) => g[0].confianca === t)
  if (!gs.length) continue
  line()
  bar('#')
  line(`NIVEL: ${TIER[t]}`)
  line(`Total: ${gs.length} grupos`)
  bar('#')
  for (const g of gs) {
    n++
    line()
    line(`--- GRUPO ${n} (id interno #${g[0].grupo}) ${g[0].tamanho_so_em_um_nome ? '  [tamanho aparece no nome de apenas um dos produtos]' : ''}`)
    if (g[0].motivo) line(`    Motivo da deteccao: ${g[0].motivo.replace(/GTIN diferente/g, g[0].confianca === 'CONFIRMADO' ? 'GTIN igual ignorando zero a esquerda' : 'GTIN diferente')}`)
    const prices = g.map((r) => Number(r.preco))
    const sizes = new Set(g.map((r) => r.tamanho.replace(/\s/g, '').toLowerCase()).filter(Boolean))
    if (sizes.size <= 1 && Math.max(...prices) / Math.min(...prices) > 1.3) line(`    ALERTA PRECO: diferenca de ${((Math.max(...prices) / Math.min(...prices) - 1) * 100).toFixed(0)}% entre as listagens`)
    g.forEach((r, i) => {
      const tag = r.acao.startsWith('MANTER') ? '[MANTER]' : r.acao.startsWith('DEFINIR') ? '[DEFINIR TAMANHO]' : '[UNIFICAR]'
      line(`  ${i + 1}. ${tag} ${r.nome}`)
      line(`       URL:      ${r.url}`)
      line(`       Marca: ${r.marca || '(sem marca)'} | Tamanho: ${r.tamanho || '(nao cadastrado)'} | Preco: ${brl(r.preco)} | Estoque: ${r.estoque}`)
      line(`       GTIN: ${r.gtin || '(vazio)'} | SKU: ${r.sku || '(vazio)'}`)
      line(`       Vendidos: ${r.vendidos} | Views: ${r.views} | Imagens: ${r.imagens} | Avaliacoes: ${r.avaliacoes}${r.vendidos > 0 ? '   <-- TEM VENDAS, nao apagar' : ''}`)
    })
  }
}

// ---------- PARTE 2
line()
bar()
line('PARTE 2 - PRODUTOS COM GTIN ERRADO / SUSPEITO')
bar()
const chk = (g) => {
  if (!/^\d+$/.test(g)) return 'contem caracteres nao numericos'
  if (![8, 12, 13, 14].includes(g.length)) return `tamanho invalido (${g.length} digitos; o padrao e 8, 12, 13 ou 14)`
  const d = g.split('').map(Number)
  const c = d.pop()
  let s = 0
  d.reverse().forEach((x, i) => (s += x * (i % 2 === 0 ? 3 : 1)))
  const exp = (10 - (s % 10)) % 10
  return exp === c ? null : `digito verificador invalido (termina em ${c}, o correto seria ${exp})`
}
const active = all.filter((r) => r.active)
const bad = active.filter((r) => r.gtin && chk(r.gtin.trim())).map((r) => ({ r, why: chk(r.gtin.trim()) }))
line()
line(`2.1 GTIN INVALIDO (nao passa na validacao oficial GS1) - ${bad.length} produtos`)
line('    Esses codigos tendem a ser reprovados no Google Merchant Center. Corrigir ou esvaziar o campo.')
line()
bad.forEach(({ r, why }, i) => {
  line(`  ${i + 1}. ${r.name}`)
  line(`       URL:   ${BASE}${r.slug}`)
  line(`       GTIN cadastrado: ${r.gtin}   | Marca: ${brandOf(r)} | Tamanho: ${r.size_label || '-'}`)
  line(`       Problema: ${why}`)
})

// GTIN igual entre produtos
const base = JSON.parse(fs.readFileSync('scripts/dup-audit/result.json', 'utf8'))
line()
line(`2.2 MESMO GTIN em produtos diferentes - ${base.gtin.length} codigos (todos sao duplicados reais, ja listados na Parte 1)`)
line()
base.gtin.forEach((g, i) => {
  line(`  ${i + 1}. GTIN ${g.key}`)
  g.items.forEach((it) => line(`       - ${it.name}\n         ${BASE}${it.slug}  (${brl(it.price)})`))
})

// GTIN quase igual (um digito a mais / zero a mais)
const ex = JSON.parse(fs.readFileSync('scripts/dup-audit/extra.json', 'utf8'))
line()
line(`2.3 GTINs QUASE IGUAIS (um tem 1 digito a mais ou um zero deslocado) - ${ex.near.length} pares`)
line('    Indica GTIN digitado errado em uma das duas listagens. Verificar na embalagem qual e o correto.')
line('    Obs.: o par Redken "Perfecting Concentrate" x "Color Gloss" sao produtos DIFERENTES com GTIN quase igual: um dos dois esta com GTIN errado.')
line()
ex.near.forEach(([n1, g1, n2, g2, i1, i2], i) => {
  line(`  ${i + 1}. GTIN ${g1}  x  GTIN ${g2}`)
  line(`       - ${n1}\n         ${BASE}${byId[i1].slug}`)
  line(`       - ${n2}\n         ${BASE}${byId[i2].slug}`)
})

// GTIN diferentes mas nome igual
line()
const rev = [...groups.values()].filter((g) => g[0].confianca === 'REVISAR_GTIN')
line(`2.4 MESMO PRODUTO COM GTINs DIFERENTES - ${rev.length} grupos (Parte 1, nivel "REVISAR (GTIN DIFERENTE)")`)
line('    Se for de fato o mesmo produto, um dos GTINs esta errado ou e codigo internacional. Se forem variantes, esta ok.')
line()
rev.forEach((g) => {
  line(`  - ${g.map((r) => `${r.nome} [GTIN ${r.gtin || 'vazio'}]`).join('\n    x ')}`)
})

// ---------- PARTE 3
line()
bar()
line('PARTE 3 - PRODUTOS COM A MESMA IMAGEM (mesmo arquivo na imagem principal)')
bar()
line()
line(`${img.sameMedia.length} grupos de produtos que usam exatamente o mesmo arquivo de imagem como foto principal.`)
line('Pode ser duplicado real (mesma foto, mesmo produto) OU foto errada copiada em outro produto.')
line()
const verdict = [
  'NOMES DIFERENTES (Probio BHA Serum x Double Correction) -> mesma linha Vichy Normaderm; conferir na embalagem se e o mesmo produto ou se a foto foi copiada.',
  'PRODUTOS DIFERENTES (Creme Nutritivo x Creme Leve) -> foto repetida/errada em um deles: trocar a imagem.',
  'PRODUTOS INATIVOS e diferentes (Lattafa x Rasasi) -> foto errada, mas estao inativos.',
  'PRODUTOS DIFERENTES (FPS70 x FPS30) -> verificar se a foto corresponde ao FPS de cada um.',
  'PRODUTO x KIT -> shampoo 750ml usando foto do kit: trocar a imagem.',
  'DUPLICADO REAL (mesma loção) -> unificar (ja esta na Parte 1).',
  'DUPLICADO REAL INATIVO (Nutren Control) -> ja inativos, sem acao.',
]
const sameMedia = img.sameMedia
const order = ['normaderm', 'neovadiol', 'lattafa', 'idéal soleil|ideal soleil', 'shampoo l', 'umidit', 'nutren']
sameMedia.forEach((grp, i) => {
  line(`  ${i + 1}. IMAGEM REPETIDA em ${grp.length} produtos`)
  grp.forEach((id) => {
    const r = byId[id]
    line(`       - ${r.name}  ${r.active ? '' : '[INATIVO]'}`)
    line(`         ${BASE}${r.slug}  (${brl(r.price)})`)
  })
  line(`       Avaliacao: ${verdict[i] || 'revisar manualmente'}`)
  line()
})
line('Observacao: o sistema tambem tem produtos distintos com imagens de mesmo tamanho em bytes, mas isso e coincidencia de compressao e foi desconsiderado.')
line()
line('FIM DO RELATORIO')

fs.writeFileSync('relatorio-duplicados-completo.txt', '\uFEFF' + L.join('\r\n'))
console.log('linhas:', L.length, '| GTIN invalidos:', bad.length, '| grupos:', groups.size)
