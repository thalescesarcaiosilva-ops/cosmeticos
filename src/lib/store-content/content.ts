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
  whatsappHref: 'https://wa.me/559992129000',

  home: {
    storeAbout: {
      enabled: true,
      eyebrow: 'Nossa loja',
      title: 'Beleza é sinônimo de cuidado.',
      paragraphs: [
        'Somos uma loja especializada em cosméticos, skincare, maquiagem e higiene pessoal, com produtos selecionados para oferecer qualidade, variedade e preços acessíveis.',
        'Da escolha da fórmula certa ao atendimento no pós-venda, estamos ao seu lado em cada etapa da sua rotina de beleza.',
      ],
      imageUrl: '/loja.png',
      imageAlt: 'Interior da Batista Cosméticos',
      cta: { label: 'Conheça nossa história', href: '/paginas/quem-somos' },
    },
    newsletter: {
      eyebrow: 'Clube de Ofertas',
      title: 'Novidades e descontos antes de todo mundo',
      description:
        'Assine e receba lançamentos, promoções exclusivas e dicas de cuidado direto no seu e-mail.',
      placeholder: 'Digite seu melhor e-mail',
      buttonLabel: 'Quero receber',
      benefits: ['Ofertas exclusivas', 'Lançamentos em primeira mão', 'Dicas de skincare'],
      disclaimer: 'Você pode cancelar quando quiser.',
    },
  },

  about: {
    sobre: {
      eyebrow: 'Quem somos',
      title: 'Sobre Nós',
      paragraphs: [
        'A Batista Cosméticos nasceu com o propósito de tornar o cuidado pessoal mais acessível, prático e confiável para todos. Fundada por Eduardo Batista Prado Lessa, a loja foi criada a partir da visão de oferecer produtos de qualidade com preços justos, sem complicar a experiência de compra.',
        'Somos especializados em cosméticos, produtos de skincare, maquiagem e itens de higiene pessoal, sempre selecionados com atenção aos detalhes. Cada produto disponível em nossa loja passa por uma curadoria criteriosa, garantindo que você tenha acesso a itens que realmente entregam qualidade, segurança e bons resultados no dia a dia.',
        'Acreditamos que cuidar da beleza é também cuidar de si. Por isso, buscamos reunir em um só lugar tudo o que você precisa para sua rotina de autocuidado, com variedade, praticidade e confiança. Nosso compromisso é facilitar sua escolha, oferecendo opções que atendam diferentes necessidades e perfis.',
        'Trabalhamos constantemente para que sua experiência de compra seja simples, segura e transparente. Desde a navegação no site até o atendimento pós-venda, cada etapa é pensada para garantir comodidade e satisfação. Valorizamos o relacionamento com nossos clientes e buscamos oferecer um atendimento ágil, claro e eficiente.',
        'Mais do que vender produtos, queremos fazer parte da sua rotina, oferecendo soluções que contribuem para o seu bem-estar e autoestima. A Batista Cosméticos é o seu espaço de confiança para cuidar da beleza com praticidade e qualidade.',
      ],
    },
    storeImage: {
      enabled: true,
      eyebrow: 'Nossa loja',
      title: 'Um espaço pensado para a sua experiência de beleza.',
      imageUrl: '/loja.png',
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
          { label: 'Razão social', value: 'Eduardo Batista Prado Lessa' },
          { label: 'CNPJ', value: '67.834.759/0001-40' },
          { label: 'E-mail', value: 'atendimento@batistacosmeticos.com.br' },
          { label: 'Site', value: 'batistacosmeticos.com.br' },
          { label: 'Telefone', value: '(99) 92129-000' },
          {
            label: 'Endereço',
            value: 'Av. Octavio Mangabeira, 6929, Loja 04, Boca do Rio, Salvador/BA, CEP 41706-690',
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
      visitAddress: 'Av. Octavio Mangabeira, 6929, Loja 04, Boca do Rio, Salvador/BA, CEP 41706-690',
    },
  },
}
