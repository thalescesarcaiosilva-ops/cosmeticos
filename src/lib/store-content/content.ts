/**
 * ─────────────────────────────────────────────────────────────────────────
 *  CONTEÚDO INSTITUCIONAL DA LOJA (editável direto no código)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Aqui você configura:
 *   1. A seção "Nossa loja" que aparece na HOME (imagem + descrição).
 *   2. A página "Quem somos" (/paginas/quem-somos) por completo.
 *   3. A newsletter da home.
 *
 * COMO TROCAR AS IMAGENS DA LOJA:
 *   - Coloque o arquivo da foto em `public/` (ex.: public/loja.webp).
 *   - Aponte o caminho começando com "/" (ex.: imageUrl: '/loja.webp').
 *   - Também aceita URL completa (https://...) de imagem hospedada.
 *   - Deixe `null` para exibir um espaço reservado até você adicionar a foto.
 */

export type CtaLink = { label: string; href: string }

export type StoreInfoRow = {
  label: string
  /** Use \n para quebrar linha (ex.: endereço em várias linhas). */
  value: string
}

export type OpeningHoursRow = {
  label: string
  value: string
  /** true = destaca como "fechado" (tom apagado). */
  closed?: boolean
}

export type StoreContent = {


  home: {
    /** Seção "Nossa loja" na home: imagem à esquerda, texto à direita. */
    storeAbout: {
      enabled: boolean
      eyebrow: string
      title: string
      paragraphs: string[]
      imageUrl: string | null
      imageAlt: string
      cta: CtaLink
    }
    newsletter: {
      eyebrow: string
      title: string
      description: string
      placeholder: string
      buttonLabel: string
      benefits: string[]
      disclaimer: string
    }
  }

  about: {
    /** Texto institucional "Sobre Nós" (topo da página Quem somos). */
    sobre: {
      eyebrow: string
      title: string
      paragraphs: string[]
    }
    /** Seção dedicada à foto da loja na página Quem somos. */
    storeImage: {
      enabled: boolean
      eyebrow: string
      title: string
      imageUrl: string | null
      imageAlt: string
      caption: string
    }
    info: {
      eyebrow: string
      title: string
      label: {
        title: string
        subtitle: string
        rows: StoreInfoRow[]
      }
      hoursTitle: string
      hours: OpeningHoursRow[]
      visitTitle: string
      /** Endereço do card "Visite a loja" (use \n para quebrar linha). */
      visitAddress: string
    }
  }
}

export const storeContent: StoreContent = {


  home: {
    storeAbout: {
      enabled: true,
      eyebrow: 'Nossa loja',
      title: 'Beleza é sinônimo de cuidado.',
      paragraphs: [
        'Somos uma loja especializada em cosméticos, skincare, maquiagem e higiene pessoal, com produtos selecionados para oferecer qualidade, variedade e preços acessíveis.',
        'Da escolha da fórmula certa ao atendimento no pós-venda, estamos ao seu lado em cada etapa da sua rotina de beleza.',
      ],
      imageUrl: '/loja.webp',
      imageAlt: 'Interior da Batista Cosméticos',
      cta: { label: 'Conheça nossa história', href: '/paginas/quem-somos' },
    },
    newsletter: {
      eyebrow: 'Clube de Ofertas',
      title: 'Novidades e descontos antes de todo mundo',
      description:
        'Assine e receba lançamentos, promoções e dicas de cuidado direto no seu e-mail.',
      placeholder: 'Digite seu melhor e-mail',
      buttonLabel: 'Quero receber',
      benefits: ['Ofertas', 'Lançamentos em primeira mão', 'Dicas de skincare'],
      disclaimer: 'Você pode cancelar quando quiser.',
    },
  },

  about: {
    sobre: {
      eyebrow: 'Quem somos',
      title: 'Sobre Nós',
      paragraphs: [
        'A Batista Cosméticos é uma loja de cosméticos, skincare, maquiagem e higiene pessoal com ponto físico em Salvador (BA), no bairro Boca do Rio — Avenida Octavio Mangabeira, 6929. Você pode comprar presencialmente ou pelo site www.batistacosmeticos.com.br, sempre com as mesmas informações de contato e políticas publicadas no rodapé.',
        'Operamos como e-commerce integrado à loja física: pedidos online são separados e conferidos antes do envio pelos Correios (PAC e SEDEX), com prazos e valores descritos na Política de Frete. Não revendemos produtos usados, abertos ou fora da embalagem original.',
        'Nossa curadoria prioriza marcas reconhecidas e itens com validade e lacre conferidos. Quando você precisa de ajuda para escolher um produto, falar sobre um pedido ou solicitar troca, o canal oficial é atendimento@batistacosmeticos.com.br ou o telefone (71) 98603-5819, no horário informado nesta página.',
        'Transparência faz parte do nosso trabalho: publicamos CNPJ, endereço, formas de pagamento aceitas (Pix e cartões Visa, Mastercard, Elo e American Express), prazos de entrega e regras de devolução em páginas dedicadas — sem esconder taxas de frete no checkout.',
      ],
    },
    storeImage: {
      enabled: true,
      eyebrow: 'Nossa loja',
      title: 'Conheça o interior da Batista Cosméticos em Salvador.',
      imageUrl: '/loja.webp',
      imageAlt: 'Interior da loja física Batista Cosméticos em Salvador',
      caption:
        'Foto real do nosso espaço em Boca do Rio — a mesma vitrine que você vê na home. Não temos retratos da equipe; preferimos mostrar o ambiente onde atendemos e preparamos pedidos.',
    },
    info: {
      eyebrow: 'Informações da loja',
      title: 'Confira nossas informações',
      label: {
        title: 'Batista Cosméticos',
        subtitle: 'Ficha da loja',
        rows: [
          { label: 'Razão social', value: '67.834.759 Eduardo Batista Prado Lessa' },
          { label: 'CNPJ', value: '67.834.759/0001-40' },
          { label: 'E-mail', value: 'atendimento@batistacosmeticos.com.br' },
          { label: 'Site', value: 'www.batistacosmeticos.com.br' },
          { label: 'Telefone', value: '(71) 98603-5819' },
          {
            label: 'Endereço',
            value: 'Avenida Octavio Mangabeira, 6929, Boca do Rio, Salvador/BA, CEP: 41706-690',
          },
        ],
      },
      hoursTitle: 'Horário de atendimento',
      hours: [
        { label: 'Segunda-feira a Sexta-feira', value: '08:00h às 17:00h' },
        { label: 'Sábado', value: '08:00h às 12:00h' },
        { label: 'Domingo', value: 'Fechado. Exceto feriados', closed: true },
      ],
      visitTitle: 'Visite a loja',
      visitAddress: 'Avenida Octavio Mangabeira, 6929, Boca do Rio, Salvador/BA, CEP: 41706-690',
    },
  },
}
