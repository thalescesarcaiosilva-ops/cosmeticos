export type ProductPurchaseAssurances = {
  returnEnabled: boolean
  returnDays: number | null
  returnFree: boolean
  returnPolicyHref: string
  shippingPolicyHref: string
  paymentPolicyHref: string
  trackingHref: string
  contactHref: string
  contactEmail: string | null
  phoneDisplay: string | null
  phoneHref: string | null
  paymentLabels: string[]
  pixEnabled: boolean
  cardEnabled: boolean
}
