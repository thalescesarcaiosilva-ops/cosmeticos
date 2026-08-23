/**
 * Alinha frete (Supabase) e políticas ao Google Merchant Center.
 * Uso: node --env-file=.env.local scripts/sync-merchant-shipping-policies.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CONTACT = `<p><strong>Contato</strong><br>
Batista Cosméticos — CNPJ: 67.834.759/0001-40<br>
Avenida Octavio Mangabeira, 6929, Boca do Rio, Salvador/BA, CEP: 41706-690<br>
Telefone: (71) 98603-5819 · atendimento@batistacosmeticos.com.br<br>
Horário de atendimento: Segunda-feira a Sexta-feira: 08:00h às 17:00h. Sábado: 08:00h às 12:00h. Domingo: Fechado. Exceto feriados.</p>`

const POLITICA_FRETE = `<p>Como funciona o envio na <strong>Batista Cosméticos</strong> (CNPJ 67.834.759/0001-40).</p>

<h2>Preparação do pedido</h2>
<p>Com o pagamento confirmado, o pedido passa por <strong>1 a 2 dias úteis</strong> de processamento e separação (conferência e postagem), de segunda a sábado.</p>

<h2>PAC</h2>
<ul>
  <li><strong>Tempo de separação:</strong> 1 a 2 dias úteis</li>
  <li><strong>Tempo em trânsito:</strong> 5 a 10 dias úteis (Correios, após a postagem)</li>
  <li><strong>Valor:</strong> taxa fixa de <strong>R$ 24,90</strong> para pedidos abaixo de R$ 250,00 em produtos. <strong>Frete grátis no PAC</strong> a partir de R$ 250,00 em produtos (o valor do frete não entra no cálculo).</li>
</ul>

<h2>SEDEX</h2>
<ul>
  <li><strong>Tempo de separação:</strong> 1 a 2 dias úteis</li>
  <li><strong>Tempo em trânsito:</strong> 4 a 7 dias úteis (Correios, após a postagem)</li>
  <li><strong>Valor:</strong> taxa fixa de <strong>R$ 39,90</strong> para todos os pedidos. O SEDEX não participa da promoção de frete grátis.</li>
</ul>

<h2>Entrega e endereço</h2>
<p>Até três tentativas pelos Correios, em regra. Endereço incompleto pode atrasar, devolver o pacote ou gerar reenvio — consulte a <a href="/paginas/politica-de-reembolso">Política de Reembolso</a>.</p>

<h2>Atrasos externos</h2>
<p>Greves, clima, feriados ou restrições dos Correios podem alterar a estimativa. Comunicamos impactos relevantes quando aplicável.</p>

${CONTACT}`

async function updateShipping() {
  const { data: methods } = await admin.from('shipping_methods').select('id, name').eq('active', true)

  for (const method of methods ?? []) {
    const name = method.name.trim().toUpperCase()
    if (name === 'PAC') {
      const { error } = await admin
        .from('shipping_methods')
        .update({
          base_price: 24.9,
          free_above: 250,
          estimated_days_min: 6,
          estimated_days_max: 12,
        })
        .eq('id', method.id)
      if (error) throw error
      console.log('PAC atualizado: total 6–12, grátis ≥ R$ 250, R$ 24,90 abaixo')
    } else if (name === 'SEDEX') {
      const { error } = await admin
        .from('shipping_methods')
        .update({
          base_price: 39.9,
          free_above: null,
          estimated_days_min: 5,
          estimated_days_max: 9,
        })
        .eq('id', method.id)
      if (error) throw error
      console.log('SEDEX atualizado: total 5–9, R$ 39,90 fixo')
    }
  }
}

async function patchPolicy(slug, transform) {
  const { data, error: readErr } = await admin
    .from('footer_pages')
    .select('id, content')
    .eq('slug', slug)
    .maybeSingle()

  if (readErr) throw readErr
  if (!data) {
    console.warn(`Página não encontrada: ${slug}`)
    return
  }

  const content = transform(data.content ?? '')
  const { error } = await admin.from('footer_pages').update({ content }).eq('id', data.id)
  if (error) throw error
  console.log(`Política atualizada: ${slug}`)
}

async function updatePolicies() {
  await patchPolicy('politica-de-frete', () => POLITICA_FRETE)

  await patchPolicy('politica-de-trocas-e-devolucoes', (html) => {
    let next = html
    next = next.replace(
      /Em resumo[\s\S]*?reembolso em até 7 dias úteis após a aprovação\./,
      `Em resumo: Brasil · só itens novos · devolução com/sem defeito · troca permitida · arrependimento em <strong>7 dias corridos</strong> após receber · devolução pelos Correios · etiqueta gratuita nos casos cobertos · sem taxa de reposição · cancelamento <strong>antes da postagem</strong>: reembolso em até <strong>3 dias úteis</strong> após confirmação · demais reembolsos: até <strong>7 dias úteis</strong> após aprovação (análise do retorno pode levar até 5 dias úteis).`
    )
    return next
  })

  await patchPolicy('politica-de-reembolso', (html) => {
    let next = html
    if (!next.includes('3 dias úteis') || !next.includes('antes da postagem')) {
      next = next.replace(
        /Depois da aprovação, processamos o reembolso em até 7 dias úteis \./,
        `Cancelamento <strong>antes da postagem</strong>: reembolso em até <strong>3 dias úteis</strong> após confirmarmos o cancelamento. Nos demais casos, após a aprovação, processamos o reembolso em até <strong>7 dias úteis</strong>.`
      )
    }
    return next
  })

  await patchPolicy('termos-e-condicoes-de-uso', (html) => {
    return html.replace(
      /Privacidade, Frete, Trocas e Devoluções e Reembolso/,
      'Privacidade, Frete, Trocas e Devoluções, Reembolso, Formas de Pagamento e Aviso Legal'
    )
  })

  await patchPolicy('politica-de-privacidade', (html) => {
    if (html.includes('representação legal') || html.includes('consentimento dos responsáveis')) {
      return html
    }
    return html.replace(
      /(menores de 18 anos[^<]*)/i,
      'menores de 18 anos apenas com representação ou consentimento do responsável legal, nos termos da legislação aplicável'
    )
  })

  await patchPolicy('termos-e-condicoes-de-uso', (html) => {
    if (html.includes('representação ou consentimento do responsável')) {
      return html
    }
    return html.replace(
      /(maiores de 18 anos[^<\.]*)/i,
      'maiores de 18 anos, ou menores com representação ou consentimento do responsável legal'
    )
  })
}

async function updateSiteSettings() {
  const { error } = await admin
    .from('site_settings')
    .update({
      help_href: '/paginas/fale-conosco',
      seo_handling_days_min: 1,
      seo_handling_days_max: 2,
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')

  if (error) {
    console.warn('site_settings:', error.message)
  } else {
    console.log('site_settings: help_href e handling 1–2')
  }
}

async function main() {
  await updateShipping()
  await updatePolicies()
  await updateSiteSettings()
  console.log('Concluído.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
