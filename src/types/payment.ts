export type PaymentMethod = {
  id: string
  label: string
  imageUrl: string | null
}

/** Sugestões rápidas ao adicionar formas de pagamento no admin */
export const PAYMENT_METHOD_SUGGESTIONS: { id: string; label: string }[] = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'elo', label: 'Elo' },
  { id: 'amex', label: 'American Express' },
  { id: 'pix', label: 'Pix' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'pagseguro', label: 'PagSeguro' },
  { id: 'mercadopago', label: 'Mercado Pago' },
]

export type PaymentSettings = {
  maxInstallments: number
  interestFreeInstallments: number
  minInstallmentValue: number
  monthlyInterestRate: number
  /** Taxa mensal (%) por número de parcelas — ex.: { 6: 1.99, 12: 3.49 } */
  installmentInterestRates: Record<number, number>
  installmentTextInterestFree: string
  installmentTextWithInterest: string
  paymentMethods: PaymentMethod[]
}

export type InstallmentDisplay = {
  count: number
  value: number
  /** Total a pagar no cartão nesta opção (com juros, se houver). */
  total: number
  interestFree: boolean
  template: string
  label: string
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  maxInstallments: 12,
  interestFreeInstallments: 1,
  minInstallmentValue: 5,
  monthlyInterestRate: 0,
  /** Taxas totais (%) por parcela — alinhadas à tabela PayoutBR (repasse no cartão). */
  installmentInterestRates: {
    2: 24.15,
    3: 25.63,
    4: 26,
    5: 26.85,
    6: 27.42,
    7: 27.5,
    8: 29.5,
    9: 28.4,
    10: 36,
    11: 37,
    12: 38,
  },
  installmentTextInterestFree: '{count}x de {value} sem juros',
  installmentTextWithInterest: '{count}x de {value} com juros',
  paymentMethods: [],
}

export type ContactSupportTopic = {
  title: string
  description: string
}

export const DEFAULT_CONTACT_SUPPORT_TOPICS: ContactSupportTopic[] = [
  {
    title: 'Pedidos e entregas',
    description: 'Acompanhe prazos, alterações de endereço e status do seu pedido.',
  },
  {
    title: 'Produtos e estoque',
    description: 'Tire dúvidas sobre disponibilidade, composição e indicações de uso.',
  },
  {
    title: 'Trocas e devoluções',
    description: 'Saiba como solicitar troca ou devolução conforme nossa política.',
  },
]

export type CheckoutPaymentSettings = {
  pixEnabled: boolean
  pixDiscount: number
  cardEnabled: boolean
}

export const DEFAULT_CHECKOUT_PAYMENT_SETTINGS: CheckoutPaymentSettings = {
  pixEnabled: true,
  pixDiscount: 0,
  cardEnabled: true,
}
