/**
 * ─────────────────────────────────────────────────────────────────────────
 *  CONTEÚDO INSTITUCIONAL DA LOJA (editável direto no código)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Aqui você configura:
 *   1. A seção "Nossa loja" que aparece na HOME (imagem + descrição).
 *   2. A página "Quem somos" (/quem-somos) por completo.
 *   3. A newsletter da home.
 *
 * COMO TROCAR AS IMAGENS DA LOJA:
 *   - Coloque o arquivo da foto em `public/` (ex.: public/loja.jpg).
 *   - Aponte o caminho começando com "/" (ex.: imageUrl: '/loja.jpg').
 *   - Também aceita URL completa (https://...) de imagem hospedada.
 *   - Deixe `null` para exibir um espaço reservado até você adicionar a foto.
 */

export type CtaLink = { label: string; href: string }

export type StoreInfoRow = {
  label: string
  /** Use \n para quebrar linha (ex.: endereço em várias linhas). */
  value: string
}

export type OfferingCard = {
  /** Cor do marcador: 'rose' | 'gold' | 'sage' (paleta institucional). */
  accent: 'rose' | 'gold' | 'sage'
  title: string
  description: string
}

export type OpeningHoursRow = {
  label: string
  value: string
  /** true = destaca como "fechado" (tom apagado). */
  closed?: boolean
}

export type StoreContent = {
  /** Link do botão "Fale conosco" / WhatsApp usado nos CTAs institucionais. */
  whatsappHref: string

  home: {
    /** Seção "Nossa loja" na home: imagem à esquerda, texto à direita. */
    storeAbout: {
      enabled: boolean
      eyebrow: string
      title: string
      paragraphs: string[]
      imageUrl: 'public/loja.jpg' | null
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
    hero: {
      eyebrow: string
      titleLead: string
      titleAccent: string
      description: string
      primaryCta: CtaLink
      secondaryCta: CtaLink
    }
    essence: {
      eyebrow: string
      title: string
      /** Aceita <strong> simples? Não — texto puro. Use paragraphs separados. */
      paragraphs: string[]
    }
    offerings: {
      eyebrow: string
      title: string
      cards: OfferingCard[]
      values: string[]
    }
    /** Seção dedicada à foto da loja na página Quem somos. */
    storeImage: {
      enabled: boolean
      eyebrow: string
      title: string
      imageUrl: 'public/loja.jpg' | null
      imageAlt: string
      caption: string
    }
    info: {
      eyebrow: string
      title: string
      label: {
        title: string
        subtitle: string
        sealText: string
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
  whatsappHref: 'https://wa.me/5599921290000',

  home: {
    storeAbout: {
      enabled: true,
      eyebrow: 'Nossa loja',
      title: 'Beleza é sinônimo de cuidado.',
      paragraphs: [
        'Somos uma loja especializada em cosméticos, skincare, maquiagem e higiene pessoal, com produtos selecionados para oferecer qualidade, variedade e preços acessíveis.',
        'Da escolha da fórmula certa ao atendimento no pós-venda, estamos ao seu lado em cada etapa da sua rotina de beleza.',
      ],
      imageUrl: null,
      imageAlt: 'Fachada da Batista Cosméticos',
      cta: { label: 'Conheça nossa história', href: '/quem-somos' },
    },
    newsletter: {
      eyebrow: 'Clube de Ofertas',
      title: 'Novidades e descontos antes de todo mundo',
      description:
        'Assine e receba lançamentos, promoções exclusivas e dicas de cuidado direto no seu e-mail.',
      placeholder: 'Digite seu melhor e-mail',
      buttonLabel: 'Quero receber',
      benefits: ['Ofertas exclusivas', 'Lançamentos em primeira mão', 'Dicas de skincare'],
      disclaimer: 'Sem spam. Você pode cancelar quando quiser.',
    },
  },

  about: {
    hero: {
      eyebrow: 'Quem somos',
      titleLead: 'Beleza é sinônimo',
      titleAccent: 'de cuidado.',
      description:
        'Somos uma loja especializada em cosméticos, produtos de skincare, maquiagem e itens de higiene pessoal, sempre selecionados para oferecer qualidade, variedade e preços acessíveis.',
      primaryCta: { label: 'Falar no WhatsApp', href: 'https://wa.me/5599921290000' },
      secondaryCta: { label: 'Ver horários e endereço', href: '#informacoes' },
    },
    essence: {
      eyebrow: 'Nossa essência',
      title: 'Cuidado que começa antes do produto chegar até você.',
      paragraphs: [
        'Na Batista Cosméticos, cada item da nossa vitrine passa por uma seleção cuidadosa antes de chegar até a sua casa. Acreditamos que cuidar da beleza é, acima de tudo, cuidar de si — por isso reunimos skincare, maquiagem e higiene pessoal em um só lugar, com a curadoria de quem entende do assunto.',
        'Trabalhamos para que comprar cosméticos online seja simples, seguro e agradável, sem abrir mão da qualidade nem do preço justo. Da escolha da fórmula certa ao atendimento no pós-venda, estamos ao seu lado em cada etapa.',
      ],
    },
    offerings: {
      eyebrow: 'O que oferecemos',
      title: 'Três frentes de cuidado, um único endereço.',
      cards: [
        {
          accent: 'rose',
          title: 'Skincare',
          description:
            'Produtos para todas as etapas da rotina de pele, escolhidos por qualidade e resultado real.',
        },
        {
          accent: 'gold',
          title: 'Maquiagem',
          description:
            'Variedade de tons e acabamentos para todo tipo de pele, momento e estilo.',
        },
        {
          accent: 'sage',
          title: 'Higiene pessoal',
          description:
            'Itens essenciais do dia a dia, com a mesma atenção à qualidade dos demais produtos.',
        },
      ],
      values: ['Qualidade', 'Variedade', 'Preços acessíveis', 'Atendimento próximo'],
    },
    storeImage: {
      enabled: true,
      eyebrow: 'Nossa loja',
      title: 'Um espaço pensado para a sua experiência de beleza.',
      imageUrl: null,
      imageAlt: 'Interior da Batista Cosméticos',
      caption: 'Venha nos visitar e conhecer pessoalmente nossa curadoria de produtos.',
    },
    info: {
      eyebrow: 'Informações da loja',
      title: 'Assim como todo bom produto, deixamos nossos dados no rótulo.',
      label: {
        title: 'Batista Cosméticos',
        subtitle: 'Ficha da loja',
        sealText: 'cuida\nde você',
        rows: [
          { label: 'Nome fantasia', value: 'Batista Cosméticos' },
          { label: 'Razão social', value: 'Eduardo Batista Prado Lessa' },
          { label: 'CNPJ', value: '67.834.759/0001-40' },
          { label: 'E-mail', value: 'atendimento@batistacosmeticos.com.br' },
          { label: 'Site', value: 'batistacosmeticos.com' },
          { label: 'Telefone', value: '(99) 92129-000' },
          {
            label: 'Endereço',
            value: 'Av. Octavio Mangabeira, 6929 – Loja 04\nBoca do Rio, Salvador – BA\nCEP 41706-690',
          },
        ],
      },
      hoursTitle: 'Horário de atendimento',
      hours: [
        { label: 'Segunda a sexta', value: '08h às 17h' },
        { label: 'Sábado', value: '08h às 12h' },
        { label: 'Domingo', value: 'Fechado', closed: true },
      ],
      visitTitle: 'Visite a loja',
      visitAddress: 'Av. Octavio Mangabeira, 6929 – Loja 04\nBoca do Rio, Salvador – BA\nCEP 41706-690',
    },
  },
}
