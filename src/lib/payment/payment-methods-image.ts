/**
 * Imagem única com todas as formas de pagamento aceitas.
 *
 * Edite aqui no projeto (sem admin / sem banco):
 *   1. Coloque o arquivo em `public/` (ex.: public/formasdepagamento.png)
 *   2. Defina `imageUrl: '/formasdepagamento.png'`
 */
export const paymentMethodsImageConfig = {
  imageUrl: '/formasdepagamento.png',
  alt: 'Formas de pagamento aceitas',
}

export function hasPaymentMethodsImage(): boolean {
  return Boolean(paymentMethodsImageConfig.imageUrl?.trim())
}
