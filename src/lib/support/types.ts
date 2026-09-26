export type SupportQueueItem = {
  id: string
  number: string
  createdAt: string
  status: 'pending' | 'cancelled'
  statusLabel: string
  paymentMethod: string
  proofPending: boolean
  messageSentAt: string | null
  pixCopyPaste: string | null
  pixExpiresAt: string | null
  customerName: string
  customerEmail: string
  phone: string | null
  phoneLabel: string
  telUrl: string | null
  whatsappUrl: string | null
  whatsappMessage: string
  address: string
  items: Array<{
    name: string
    quantity: number
    lineTotal: number
    lineTotalLabel: string
  }>
  subtotalLabel: string
  discountLabel: string | null
  shippingLabel: string
  total: number
  totalLabel: string
  copyText: string
}
