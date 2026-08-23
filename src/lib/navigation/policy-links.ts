/** Rotas canônicas das políticas — mesmas URLs usadas no FAQ da PDP e no rodapé. */
export const POLICY_PATHS = {
  terms: '/paginas/termos-e-condicoes-de-uso',
  privacy: '/paginas/politica-de-privacidade',
  returns: '/paginas/politica-de-trocas-e-devolucoes',
  refund: '/paginas/politica-de-reembolso',
  shipping: '/paginas/politica-de-frete',
  payment: '/paginas/formas-de-pagamento',
  contact: '/paginas/fale-conosco',
  about: '/paginas/quem-somos',
} as const

export type PolicyPathKey = keyof typeof POLICY_PATHS
