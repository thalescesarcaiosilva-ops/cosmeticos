'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CreditCard, QrCode } from 'lucide-react'
import { CheckoutOrderSummary } from '@/components/checkout/CheckoutOrderSummary'
import { CheckoutPanel } from '@/components/checkout/CheckoutPanel'
import { CheckoutPaymentBrands } from '@/components/checkout/CheckoutPaymentBrands'
import { CheckoutPixPanel } from '@/components/checkout/CheckoutPixPanel'
import { PayoutCardForm, type PayoutCardFormHandle } from '@/components/checkout/PayoutCardForm'
import { CheckoutSecurityBadges } from '@/components/checkout/CheckoutSecurityBadges'
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper'
import { CheckoutTopBar } from '@/components/checkout/CheckoutTopBar'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  guestOrderHeaders,
  guestOrderQuery,
  storeGuestOrderToken,
} from '@/lib/checkout/guest-access'
import {
  formatCepInput,
  formatCpfInput,
  formatPhoneInput,
  mapCheckoutApiError,
  onlyDigits,
  validateCheckoutAddress,
  validateCheckoutCpf,
  validateCheckoutIdentification,
  type FieldErrors,
} from '@/lib/checkout/validation'
import { formatCurrency } from '@/lib/products/format'
import { useCartSync } from '@/hooks/useCartSync'
import { useCart } from '@/providers/CartProvider'
import type { CheckoutPaymentSettings, PaymentMethod, PaymentSettings } from '@/types/payment'
import type { StoreLogo } from '@/types/layout'
import type { ShippingQuoteLine } from '@/types/shipping'

type Profile = {
  name: string
  email: string
  phone: string | null
}

type Address = {
  id: string
  label: string | null
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zip_code: string
  is_default: boolean
}

type AddressForm = {
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zip_code: string
}

const emptyAddressForm: AddressForm = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
}

type PaymentMethodChoice = 'pix' | 'card'

type CheckoutViewProps = {
  storeName: string
  logo: StoreLogo
}

function calcPixDiscountAmount(subtotal: number, shipping: number, percent: number): number {
  if (percent <= 0) return 0
  return Math.round((subtotal + shipping) * (percent / 100) * 100) / 100
}

export function CheckoutView({ storeName, logo }: CheckoutViewProps) {
  const router = useRouter()
  const cardFormRef = useRef<PayoutCardFormHandle>(null)
  const { items, clearCart } = useCart()
  const { data: cart, loading: cartLoading, error: cartError } = useCartSync()

  const [profileLoading, setProfileLoading] = useState(true)
  const [identification, setIdentification] = useState({ name: '', email: '', phone: '' })
  const [identificationError, setIdentificationError] = useState<string | null>(null)
  const [identificationFieldErrors, setIdentificationFieldErrors] = useState<
    FieldErrors<'name' | 'email' | 'phone'>
  >({})

  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [addressFieldErrors, setAddressFieldErrors] = useState<FieldErrors<keyof AddressForm>>({})
  const [cepLoading, setCepLoading] = useState(false)

  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteLine[]>([])
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [paymentConfig, setPaymentConfig] = useState<CheckoutPaymentSettings | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice>('pix')
  const [cpf, setCpf] = useState('')
  const [pixResult, setPixResult] = useState<{
    orderId: string
    total: number
    discountAmount: number
    qrCode: string | null
    qrImage: string | null
    expiresAt: string | null
  } | null>(null)
  const [pixPolling, setPixPolling] = useState(false)

  const availableLines = useMemo(
    () => cart?.lines.filter((line) => line.available && line.quantity > 0) ?? [],
    [cart]
  )

  const selectedShipping = shippingOptions.find((o) => o.methodId === selectedShippingId) ?? null
  const shippingPrice = selectedShipping?.price ?? 0
  const subtotal = cart?.subtotal ?? 0
  const pixDiscountPercent = paymentConfig?.pixDiscount ?? 0
  const pixDiscountAmount =
    paymentMethod === 'pix' ? calcPixDiscountAmount(subtotal, shippingPrice, pixDiscountPercent) : 0
  const total = Math.max(subtotal + shippingPrice - pixDiscountAmount, 0)

  const cardBrands = useMemo(
    () =>
      paymentMethods.filter((method) => {
        const id = method.id.toLowerCase()
        return id !== 'pix' && id !== 'boleto'
      }),
    [paymentMethods]
  )

  const pixBrand = useMemo(
    () => paymentMethods.find((method) => method.id.toLowerCase().includes('pix')) ?? null,
    [paymentMethods]
  )

  useEffect(() => {
    async function loadProfile() {
      const { data: profileData, error } = await fetchApi<Profile & { id: string }>(
        '/api/account/profile'
      )
      setProfileLoading(false)
      if (error || !profileData) return

      setIdentification({
        name: profileData.name ?? '',
        email: profileData.email ?? '',
        phone: profileData.phone ?? '',
      })
    }

    async function loadAddresses() {
      const { data, error } = await fetchApi<Address[]>('/api/account/addresses')
      if (error || !data?.length) return

      const preferred = data.find((a) => a.is_default) ?? data[0]!
      setAddressForm({
        street: preferred.street,
        number: preferred.number,
        complement: preferred.complement ?? '',
        neighborhood: preferred.neighborhood,
        city: preferred.city,
        state: preferred.state,
        zip_code: preferred.zip_code,
      })
    }

    async function loadPaymentConfig() {
      const { data } = await fetchApi<{
        checkout: CheckoutPaymentSettings
        installments: PaymentSettings
      }>('/api/payout/config')

      if (data?.checkout) {
        setPaymentConfig(data.checkout)
        if (data.checkout.pixEnabled) {
          setPaymentMethod('pix')
        } else if (data.checkout.cardEnabled) {
          setPaymentMethod('card')
        }
      }

      if (data?.installments?.paymentMethods) {
        setPaymentMethods(data.installments.paymentMethods)
      }
    }

    loadProfile()
    loadAddresses()
    loadPaymentConfig()
  }, [])

  const loadShipping = useCallback(
    async (cep: string, orderSubtotal: number): Promise<ShippingQuoteLine | null> => {
      const digits = cep.replace(/\D/g, '')
      if (digits.length !== 8 || orderSubtotal <= 0) return null

      setShippingLoading(true)
      setShippingError(null)
      setShippingOptions([])
      setSelectedShippingId(null)

      const { data, error } = await fetchApi<{ options: ShippingQuoteLine[] }>(
        '/api/shipping/quote',
        {
          method: 'POST',
          body: JSON.stringify({ cep: digits, subtotal: orderSubtotal }),
        }
      )

      setShippingLoading(false)

      if (error || !data?.options?.length) {
        setShippingError(error ?? 'Nenhuma forma de frete disponível para este CEP')
        return null
      }

      setShippingOptions(data.options)
      const first = data.options[0]!
      setSelectedShippingId(first.methodId)
      return first
    },
    []
  )

  useEffect(() => {
    const cep = addressForm.zip_code.replace(/\D/g, '')
    if (cep.length === 8 && subtotal > 0) {
      loadShipping(cep, subtotal)
    }
  }, [addressForm.zip_code, subtotal, loadShipping])

  function updateAddressField(field: keyof AddressForm, value: string) {
    if (field === 'zip_code') {
      const formatted = formatCepInput(value)
      setAddressForm((prev) => ({ ...prev, zip_code: formatted }))
      setAddressFieldErrors((prev) => ({ ...prev, zip_code: undefined }))
      return
    }

    setAddressForm((prev) => ({
      ...prev,
      [field]: field === 'state' ? value.toUpperCase().slice(0, 2) : value,
    }))
    setAddressFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function lookupCep(cep: string) {
    const digits = onlyDigits(cep)
    if (digits.length !== 8) return

    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = (await res.json()) as {
        erro?: boolean
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
      }

      if (data.erro) {
        setAddressFieldErrors((prev) => ({
          ...prev,
          zip_code: 'CEP não encontrado',
        }))
        return
      }

      setAddressForm((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }))
    } catch {
      // Falha silenciosa
    } finally {
      setCepLoading(false)
    }
  }

  function buildCheckoutPayload(extra?: Record<string, unknown>) {
    return {
      shipping_method_id: selectedShippingId,
      document: onlyDigits(cpf),
      customer: {
        name: identification.name.trim(),
        email: identification.email.trim(),
        phone: onlyDigits(identification.phone),
      },
      shipping_address: {
        street: addressForm.street,
        number: addressForm.number,
        complement: addressForm.complement || null,
        neighborhood: addressForm.neighborhood,
        city: addressForm.city,
        state: addressForm.state.toUpperCase(),
        zip_code: addressForm.zip_code,
      },
      items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
      ...extra,
    }
  }

  const pollPaymentStatus = useCallback(async (orderId: string): Promise<boolean> => {
    const { data } = await fetchApi<{ status: string }>(
      `/api/checkout/orders/${orderId}/payment-status${guestOrderQuery(orderId)}`,
      { headers: guestOrderHeaders(orderId) }
    )
    return data?.status === 'paid'
  }, [])

  useEffect(() => {
    if (!pixResult?.orderId) return

    let active = true
    setPixPolling(true)

    async function check() {
      const paid = await pollPaymentStatus(pixResult!.orderId)
      if (!active) return
      if (paid) {
        clearCart()
        setPixPolling(false)
        router.push(`/pedido/${pixResult!.orderId}/obrigado${guestOrderQuery(pixResult!.orderId)}`)
      }
    }

    check()
    const interval = setInterval(check, 4000)

    return () => {
      active = false
      clearInterval(interval)
      setPixPolling(false)
    }
  }, [pixResult, pollPaymentStatus, clearCart, router])

  async function handlePixPayment() {
    setSubmitError(null)
    setCpfError(null)

    if (!selectedShippingId || availableLines.length === 0) {
      setSubmitError('Complete seus dados e selecione o frete antes de pagar')
      return
    }

    const cpfResult = validateCheckoutCpf(cpf)
    if (!cpfResult.ok) {
      setCpfError(cpfResult.message)
      return
    }

    setSubmitting(true)

    const { data, error, message } = await fetchApi<{
      orderId: string
      guestAccessToken?: string | null
      total: number
      discountAmount: number
      qrCode: string | null
      qrImage: string | null
      expiresAt: string | null
    }>('/api/checkout/pix', {
      method: 'POST',
      body: JSON.stringify(buildCheckoutPayload()),
    })

    setSubmitting(false)

    if (error || !data?.orderId) {
      setSubmitError(mapCheckoutApiError(error, message))
      return
    }

    if (data.guestAccessToken) {
      storeGuestOrderToken(data.orderId, data.guestAccessToken)
    }

    setPixResult({
      orderId: data.orderId,
      total: data.total,
      discountAmount: data.discountAmount,
      qrCode: data.qrCode,
      qrImage: data.qrImage,
      expiresAt: data.expiresAt,
    })
  }

  function handleCardSuccess(result: {
    orderId: string
    paid: boolean
    guestAccessToken?: string | null
  }) {
    if (result.guestAccessToken) {
      storeGuestOrderToken(result.orderId, result.guestAccessToken)
    }
    clearCart()
    router.push(`/pedido/${result.orderId}/obrigado${guestOrderQuery(result.orderId)}`)
  }

  async function handleFinalizeOrder() {
    setSubmitError(null)
    setIdentificationError(null)
    setIdentificationFieldErrors({})
    setDeliveryError(null)
    setAddressFieldErrors({})
    setCpfError(null)

    const idResult = validateCheckoutIdentification(identification)
    if (!idResult.ok) {
      setIdentificationFieldErrors(idResult.errors)
      const first = Object.values(idResult.errors)[0]
      if (first) setIdentificationError(first)
      return
    }

    const addressResult = validateCheckoutAddress(addressForm)
    if (!addressResult.ok) {
      setAddressFieldErrors(addressResult.errors)
      setDeliveryError(addressResult.message)
      return
    }

    let shippingId = selectedShippingId
    if (!shippingId && !shippingLoading) {
      const cep = addressForm.zip_code.replace(/\D/g, '')
      if (cep.length === 8) {
        const quoted = await loadShipping(cep, subtotal)
        shippingId = quoted?.methodId ?? null
      }
    }

    if (!shippingId) {
      setDeliveryError('Selecione uma forma de frete')
      return
    }

    setSelectedShippingId(shippingId)

    const cpfResult = validateCheckoutCpf(cpf)
    if (!cpfResult.ok) {
      setCpfError(cpfResult.message)
      return
    }

    if (pixResult) return

    if (paymentMethod === 'pix') {
      await handlePixPayment()
      return
    }

    setSubmitting(true)
    try {
      await cardFormRef.current?.submit()
    } finally {
      setSubmitting(false)
    }
  }

  const isEmpty = items.length === 0 && !cartLoading

  const summaryProps = {
    lines: availableLines,
    subtotal,
    loading: cartLoading,
    selectedShipping,
    shippingLoading,
    discountAmount: pixDiscountAmount,
    total,
    onFinalize: pixResult ? undefined : handleFinalizeOrder,
    finalizeDisabled:
      cartLoading ||
      submitting ||
      availableLines.length === 0 ||
      (paymentMethod === 'pix' && paymentConfig?.pixEnabled === false) ||
      (paymentMethod === 'card' && paymentConfig?.cardEnabled === false),
    finalizeLoading: submitting,
    finalizeLabel: paymentMethod === 'pix' ? 'Finalizar pedido' : 'Finalizar pedido',
  }

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-surface">
        <CheckoutTopBar storeName={storeName} logo={logo} />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Finalizar compra</h1>
          <p className="mt-4 text-text-secondary">Seu carrinho está vazio.</p>
          <Link href="/" className="mt-6 inline-block">
            <Button type="button">Continuar comprando</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen  pb-12">
      <CheckoutTopBar storeName={storeName} logo={logo} />

      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
        <CheckoutStepper />

        {(cartError || submitError) && (
          <div className="mt-6 space-y-2">
            {cartError && <Alert type="error">{cartError}</Alert>}
            {submitError && <Alert type="error">{submitError}</Alert>}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px] xl:items-start">
          <div className="space-y-6">
            <CheckoutPanel title="Identificação">
              {profileLoading ? (
                <p className="text-sm text-text-secondary">Carregando seus dados...</p>
              ) : (
                <div className="space-y-4">
                  {identificationError && <Alert type="error">{identificationError}</Alert>}
                  <Input
                    label="Nome completo"
                    value={identification.name}
                    onChange={(e) => {
                      setIdentification((prev) => ({ ...prev, name: e.target.value }))
                      setIdentificationFieldErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    placeholder="Ex: Maria da Silva"
                    error={identificationFieldErrors.name}
                    required
                    autoComplete="name"
                    maxLength={120}
                  />
                  <Input
                    label="E-mail"
                    type="email"
                    value={identification.email}
                    onChange={(e) => {
                      setIdentification((prev) => ({ ...prev, email: e.target.value }))
                      setIdentificationFieldErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    placeholder="seu@email.com"
                    error={identificationFieldErrors.email}
                    required
                    autoComplete="email"
                    maxLength={200}
                  />
                  <div className="space-y-1">
                    <label htmlFor="checkout-phone" className="block text-sm font-medium text-text-primary">
                      Celular / WhatsApp
                    </label>
                    <div className="flex overflow-hidden rounded-md border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                      <span className="flex items-center border-r border-border bg-surface px-3 text-xs font-medium text-text-secondary">
                        BR +55
                      </span>
                      <input
                        id="checkout-phone"
                        type="tel"
                        value={identification.phone}
                        onChange={(e) => {
                          setIdentification((prev) => ({
                            ...prev,
                            phone: formatPhoneInput(e.target.value),
                          }))
                          setIdentificationFieldErrors((prev) => ({ ...prev, phone: undefined }))
                        }}
                        placeholder="(11) 96123-4567"
                        className="min-w-0 flex-1 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                        autoComplete="tel"
                        required
                      />
                    </div>
                    {identificationFieldErrors.phone && (
                      <p className="text-xs text-red-600">{identificationFieldErrors.phone}</p>
                    )}
                  </div>
                </div>
              )}
            </CheckoutPanel>

            <CheckoutPanel title="Forma de entrega">
              <div className="space-y-4">
                {deliveryError && <Alert type="error">{deliveryError}</Alert>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="CEP"
                    value={addressForm.zip_code}
                    onChange={(e) => updateAddressField('zip_code', e.target.value)}
                    onBlur={() => lookupCep(addressForm.zip_code)}
                    placeholder="00000-000"
                    error={addressFieldErrors.zip_code}
                    required
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={9}
                  />
                  {cepLoading && (
                    <p className="-mt-2 text-xs text-text-muted sm:col-span-2">Buscando endereço...</p>
                  )}
                  <Input
                    label="Rua"
                    value={addressForm.street}
                    onChange={(e) => updateAddressField('street', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                    className="sm:col-span-2"
                    error={addressFieldErrors.street}
                    required
                    autoComplete="address-line1"
                    maxLength={200}
                  />
                  <Input
                    label="Número"
                    value={addressForm.number}
                    onChange={(e) => updateAddressField('number', e.target.value)}
                    error={addressFieldErrors.number}
                    required
                    maxLength={10}
                  />
                  <Input
                    label="Complemento"
                    value={addressForm.complement}
                    onChange={(e) => updateAddressField('complement', e.target.value)}
                    placeholder="Apto, bloco..."
                    autoComplete="address-line2"
                    maxLength={100}
                  />
                  <Input
                    label="Bairro"
                    value={addressForm.neighborhood}
                    onChange={(e) => updateAddressField('neighborhood', e.target.value)}
                    placeholder="Seu bairro"
                    error={addressFieldErrors.neighborhood}
                    required
                    maxLength={100}
                  />
                  <Input
                    label="Cidade"
                    value={addressForm.city}
                    onChange={(e) => updateAddressField('city', e.target.value)}
                    error={addressFieldErrors.city}
                    required
                    autoComplete="address-level2"
                    maxLength={100}
                  />
                  <Input
                    label="Estado"
                    value={addressForm.state}
                    onChange={(e) => updateAddressField('state', e.target.value)}
                    placeholder="UF"
                    maxLength={2}
                    error={addressFieldErrors.state}
                    required
                    autoComplete="address-level1"
                  />
                </div>

                {(shippingLoading || shippingOptions.length > 0 || shippingError) && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-text-primary">Opções de frete</p>
                    {shippingLoading && (
                      <p className="text-sm text-text-secondary">Calculando frete...</p>
                    )}
                    {shippingError && <Alert type="error">{shippingError}</Alert>}
                    {!shippingLoading && shippingOptions.length > 0 && (
                      <ul className="space-y-2" role="list">
                        {shippingOptions.map((option) => {
                          const selected = selectedShippingId === option.methodId
                          return (
                            <li key={option.methodId}>
                              <button
                                type="button"
                                onClick={() => setSelectedShippingId(option.methodId)}
                                className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                                  selected
                                    ? 'border-brand bg-brand/5'
                                    : 'border-border bg-surface hover:border-brand/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-text-primary">
                                      {option.name}
                                    </p>
                                    <p className="mt-0.5 text-xs text-text-muted">
                                      {option.deliveryLabel}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-sm font-bold text-brand tabular-nums">
                                    {option.isFree ? 'Grátis' : formatCurrency(option.price)}
                                  </p>
                                </div>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </CheckoutPanel>
          </div>

          <div className="space-y-6">
            <CheckoutPanel title="Selecione a forma de pagamento">
              <div className="space-y-4">
                {paymentConfig?.pixDiscount ? (
                  <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
                    {paymentConfig.pixDiscount}% de desconto no Pix
                  </div>
                ) : null}

                <Input
                  label="CPF"
                  value={cpf}
                  onChange={(e) => {
                    setCpf(formatCpfInput(e.target.value))
                    setCpfError(null)
                  }}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  error={cpfError ?? undefined}
                  required
                  disabled={Boolean(pixResult)}
                  maxLength={14}
                />

                {!pixResult && (
                  <div className="space-y-3">
                    {paymentConfig?.cardEnabled !== false && (
                      <div
                        className={`rounded-md border transition-colors ${
                          paymentMethod === 'card' ? 'border-brand' : 'border-border'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <span
                              className={`size-4 rounded-full border ${
                                paymentMethod === 'card'
                                  ? 'border-brand bg-brand'
                                  : 'border-border-strong bg-surface'
                              }`}
                              aria-hidden
                            />
                            Pagar com cartão de crédito
                          </span>
                          <CreditCard className="size-5 text-text-muted" aria-hidden />
                        </button>
                        {paymentMethod === 'card' && (
                          <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
                            {cardBrands.length > 0 && (
                              <CheckoutPaymentBrands methods={cardBrands} variant="card" />
                            )}
                            <PayoutCardForm
                              ref={cardFormRef}
                              total={total}
                              showSubmitButton={false}
                              disabled={
                                cartLoading ||
                                !selectedShippingId ||
                                availableLines.length === 0 ||
                                onlyDigits(cpf).length !== 11
                              }
                              buildPayload={(cardHash, installments) =>
                                buildCheckoutPayload({ card_hash: cardHash, installments })
                              }
                              onSuccess={handleCardSuccess}
                              onError={setSubmitError}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {paymentConfig?.pixEnabled !== false && (
                      <div
                        className={`rounded-md border transition-colors ${
                          paymentMethod === 'pix' ? 'border-brand' : 'border-border'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('pix')}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className={`size-4 shrink-0 rounded-full border ${
                                paymentMethod === 'pix'
                                  ? 'border-brand bg-brand'
                                  : 'border-border-strong bg-surface'
                              }`}
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-text-primary">
                                Pagar com Pix
                              </span>
                              {pixDiscountPercent > 0 && (
                                <span className="mt-0.5 block text-xs text-success">
                                  {pixDiscountPercent}% de desconto
                                </span>
                              )}
                            </span>
                          </span>
                          {pixBrand?.imageUrl ? (
                            <CheckoutPaymentBrands methods={[pixBrand]} variant="pix" />
                          ) : (
                            <QrCode className="size-5 shrink-0 text-text-muted" aria-hidden />
                          )}
                        </button>
                        {paymentMethod === 'pix' && (
                          <div className="border-t border-border px-4 pb-4 pt-3">
                            <ol className="list-decimal space-y-1 pl-4 text-xs text-text-secondary">
                              <li>Clique em Finalizar pedido no resumo.</li>
                              <li>Copie o código Pix ou escaneie o QR Code.</li>
                              <li>Conclua o pagamento no app do seu banco.</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {pixResult && (
                  <CheckoutPixPanel
                    total={pixResult.total}
                    discountAmount={pixResult.discountAmount}
                    qrCode={pixResult.qrCode}
                    qrImage={pixResult.qrImage}
                    expiresAt={pixResult.expiresAt}
                    polling={pixPolling}
                    onRefresh={() => pollPaymentStatus(pixResult.orderId)}
                  />
                )}

              </div>
            </CheckoutPanel>
          </div>

          <div className="xl:hidden">
            <CheckoutOrderSummary {...summaryProps} />
          </div>

          <div className="hidden xl:block">
            <CheckoutOrderSummary {...summaryProps} />
          </div>
        </div>

        <CheckoutSecurityBadges />
      </div>
    </div>
  )
}
