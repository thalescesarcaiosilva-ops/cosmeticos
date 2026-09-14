import { NextResponse } from 'next/server'
import { getCheckoutPaymentSettings, getPaymentSettings } from '@/lib/payment/queries'

/**
 * Retorna configurações de pagamento usadas pelo CartDrawer (lado cliente).
 * Não expõe dados sensíveis — apenas configurações públicas de parcelamento e Pix.
 * Cache de 5 minutos no CDN: essas configurações raramente mudam.
 */
export async function GET() {
  try {
    const [paymentSettings, checkoutSettings] = await Promise.all([
      getPaymentSettings(),
      getCheckoutPaymentSettings(),
    ])

    return NextResponse.json(
      { error: false, data: { paymentSettings, checkoutSettings } },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: true, message: 'Não foi possível carregar configurações de pagamento' },
      { status: 500 }
    )
  }
}
