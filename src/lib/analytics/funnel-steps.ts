export const FUNNEL_STEPS = [
  'product',
  'cart_add',
  'cart',
  'checkout',
  'shipping',
  'payment',
  'purchase',
] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number]

export const FUNNEL_STEP_LABEL: Record<FunnelStep, string> = {
  product: 'Viu um produto',
  cart_add: 'Adicionou ao carrinho',
  cart: 'Abriu o carrinho',
  checkout: 'Checkout — dados',
  shipping: 'Checkout — frete',
  payment: 'Checkout — pagamento',
  purchase: 'Pedido criado',
}

export const FUNNEL_STEP_HINT: Record<FunnelStep, string> = {
  product: 'Abriu a página de um produto',
  cart_add: 'Clicou em adicionar ou em compre agora',
  cart: 'Abriu o carrinho ou a página do carrinho',
  checkout: 'Chegou na etapa dos dados',
  shipping: 'Chegou na etapa de frete e entrega',
  payment: 'Chegou na etapa de pagamento',
  purchase: 'O pedido foi criado (Pix gerado)',
}

export function isFunnelStep(value: string): value is FunnelStep {
  return (FUNNEL_STEPS as readonly string[]).includes(value)
}
