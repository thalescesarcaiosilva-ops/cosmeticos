/**
 * Imagem única com todas as formas de pagamento aceitas.
 *
 * Edite aqui no projeto (sem admin / sem banco):
 *   1. Coloque o arquivo em `public/` (ex.: public/formas-pagamento.png)
 *   2. Defina `imageUrl: '/formas-pagamento.png'`
 */
export const paymentMethodsImageConfig = {
  imageUrl: null as string | null,
  alt: 'Formas de pagamento aceitas',
}

export function hasPaymentMethodsImage(): boolean {
  return Boolean(paymentMethodsImageConfig.imageUrl?.trim())
}
