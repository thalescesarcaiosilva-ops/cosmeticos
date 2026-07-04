import { jsonSuccess } from '@/lib/api/response'
import { getPayoutApiUrl, getPayoutPublicKey } from '@/lib/payout/client'
import { getCheckoutPaymentSettings, getPaymentSettings } from '@/lib/payment/queries'
import { buildInstallmentTable } from '@/lib/payment/installment-table'

export async function GET() {
  let publicKey: string | null = null
  try {
    publicKey = getPayoutPublicKey()
  } catch {
    publicKey = null
  }

  const [checkoutSettings, paymentSettings] = await Promise.all([
    getCheckoutPaymentSettings(),
    getPaymentSettings(),
  ])

  return jsonSuccess({
    publicKey,
    apiUrl: getPayoutApiUrl(),
    checkout: checkoutSettings,
    installments: paymentSettings,
  })
}

export async function POST(request: Request) {
  let body: { total?: number } = {}
  try {
    body = (await request.json()) as { total?: number }
  } catch {
    body = {}
  }

  const paymentSettings = await getPaymentSettings()
  const total = typeof body.total === 'number' && body.total > 0 ? body.total : 0
  const installmentOptions = total > 0 ? buildInstallmentTable(total, paymentSettings) : []

  return jsonSuccess({ installmentOptions })
}
