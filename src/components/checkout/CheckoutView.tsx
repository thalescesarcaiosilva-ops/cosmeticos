'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckoutOrderSummary } from '@/components/checkout/CheckoutOrderSummary'
import { CheckoutPixPanel } from '@/components/checkout/CheckoutPixPanel'
import { PayoutCardForm } from '@/components/checkout/PayoutCardForm'
import { CheckoutSecurityBadges } from '@/components/checkout/CheckoutSecurityBadges'
import { CheckoutStepCard } from '@/components/checkout/CheckoutStepCard'
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper'
import { StoreLogoMark } from '@/components/layout/StoreLogo'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  guestOrderHeaders,
  guestOrderQuery,
  storeGuestOrderToken,
} from '@/lib/checkout/guest-access'
import { formatCurrency } from '@/lib/products/format'
import { useCartSync } from '@/hooks/useCartSync'
import { useCart } from '@/providers/CartProvider'
import { createAddressSchema } from '@/schemas/address-schema'
import type { StoreLogo } from '@/types/layout'
import type { CheckoutPaymentSettings } from '@/types/payment'

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

import type { ShippingQuoteLine } from '@/types/shipping'

type PaymentMethodChoice = 'pix' | 'card'

type CheckoutViewProps = {
  storeName: string
  logo: StoreLogo
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function calcPixDiscountAmount(subtotal: number, shipping: number, percent: number): number {
  if (percent <= 0) return 0
  return Math.round((subtotal + shipping) * (percent / 100) * 100) / 100
}

function stepStatus(step: number, currentStep: number): 'pending' | 'active' | 'completed' {
  if (step === currentStep) return 'active'
  if (step < currentStep) return 'completed'
  return 'pending'
}

function formatAddressSummary(address: AddressForm): string {
  const parts = [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city}/${address.state}`,
    address.zip_code,
  ].filter(Boolean)
  return parts.join(' — ')
}

export function CheckoutView({ storeName, logo }: CheckoutViewProps) {
  const router = useRouter()
  const { items, clearCart } = useCart()
  const { data: cart, loading: cartLoading, error: cartError } = useCartSync()

  const [currentStep, setCurrentStep] = useState(1)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [identification, setIdentification] = useState({ name: '', email: '', phone: '' })
  const [identificationError, setIdentificationError] = useState<string | null>(null)

  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)

  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteLine[]>([])
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [paymentConfig, setPaymentConfig] = useState<CheckoutPaymentSettings | null>(null)
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

  useEffect(() => {
    async function loadProfile() {
      const { data: profileData, error } = await fetchApi<Profile & { id: string }>(
        '/api/account/profile'
      )
      setProfileLoading(false)
      if (error || !profileData) return

      setProfile({
        name: profileData.name ?? '',
        email: profileData.email ?? '',
        phone: profileData.phone,
      })
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

    loadProfile()
    loadAddresses()
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
    if (currentStep < 2) return
    const cep = addressForm.zip_code.replace(/\D/g, '')
    if (cep.length === 8 && subtotal > 0) {
      loadShipping(cep, subtotal)
    }
  }, [currentStep, addressForm.zip_code, subtotal, loadShipping])

  function updateAddressField(field: keyof AddressForm, value: string) {
    setAddressForm((prev) => ({
      ...prev,
      [field]: field === 'state' ? value.toUpperCase().slice(0, 2) : value,
    }))
  }

  async function handleIdentificationContinue() {
    setIdentificationError(null)

    const name = identification.name.trim()
    const email = identification.email.trim()
    const phone = identification.phone.trim()

    if (name.length < 2) {
      setIdentificationError('Informe seu nome completo')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIdentificationError('Informe um e-mail válido')
      return
    }
    if (phone.length < 10) {
      setIdentificationError('Informe um celular válido com DDD')
      return
    }

    setProfile((prev) =>
      prev ? { ...prev, name, email, phone } : { name, email, phone: phone || null }
    )
    setCurrentStep(2)
  }

  async function handleDeliveryContinue() {
    setDeliveryError(null)

    const parsed = createAddressSchema.safeParse({
      ...addressForm,
      complement: addressForm.complement || null,
      state: addressForm.state.toUpperCase(),
    })

    if (!parsed.success) {
      setDeliveryError('Preencha todos os campos do endereço corretamente')
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
    setCurrentStep(3)
  }

  useEffect(() => {
    if (currentStep < 3) return

    async function loadPaymentConfig() {
      const { data } = await fetchApi<{
        checkout: CheckoutPaymentSettings
      }>('/api/payout/config')

      if (data?.checkout) {
        setPaymentConfig(data.checkout)
        if (data.checkout.pixEnabled) {
          setPaymentMethod('pix')
        } else if (data.checkout.cardEnabled) {
          setPaymentMethod('card')
        }
      }
    }

    loadPaymentConfig()
  }, [currentStep])

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

    if (!selectedShippingId || availableLines.length === 0) {
      setSubmitError('Complete as etapas anteriores antes de pagar')
      return
    }

    const document = onlyDigits(cpf)
    if (document.length !== 11) {
      setSubmitError('Informe um CPF válido')
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
      setSubmitError(error ?? message ?? 'Não foi possível gerar o Pix')
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

  const isEmpty = items.length === 0 && !cartLoading

  if (isEmpty) {
    return (
      <div className="bg-surface-muted">
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
    <div className="bg-surface-muted pb-12">
      <div className="border-b border-border bg-surface">
        <div className="relative mx-auto flex max-w-7xl items-center justify-center px-4 py-4 md:px-6">
          <Link
            href="/carrinho"
            className="absolute left-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-brand md:left-6"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <header>
          <h1 className="text-2xl font-bold text-text-primary md:text-3xl">Finalizar compra</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Complete as três etapas para concluir seu pedido.
          </p>
        </header>

        <CheckoutStepper currentStep={currentStep} />

        {(cartError || submitError) && (
          <div className="mt-6 space-y-2">
            {cartError && <Alert type="error">{cartError}</Alert>}
            {submitError && <Alert type="error">{submitError}</Alert>}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
          <div className="space-y-4">
            <CheckoutStepCard
              step={1}
              title="Identificação"
              subtitle="Preencha seus dados para envio do pedido."
              status={stepStatus(1, currentStep)}
              summary={
                identification.name ? (
                  <p>
                    {identification.name} · {identification.email}
                    {identification.phone ? ` · ${identification.phone}` : ''}
                  </p>
                ) : undefined
              }
              onEdit={() => setCurrentStep(1)}
            >
              {profileLoading ? (
                <p className="text-sm text-text-secondary">Carregando seus dados…</p>
              ) : (
                <div className="space-y-4">
                  {identificationError && <Alert type="error">{identificationError}</Alert>}
                  <Input
                    label="Nome completo"
                    value={identification.name}
                    onChange={(e) =>
                      setIdentification((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex: Maria da Silva"
                    required
                    autoComplete="name"
                  />
                  <Input
                    label="E-mail"
                    type="email"
                    value={identification.email}
                    onChange={(e) =>
                      setIdentification((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                  />
                  <div className="space-y-1">
                    <label htmlFor="checkout-phone" className="block text-sm font-medium text-text-primary">
                      Celular / WhatsApp
                    </label>
                    <div className="flex overflow-hidden rounded-md border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                      <span className="flex items-center border-r border-border bg-surface-muted px-3 text-xs font-medium text-text-secondary">
                        BR +55
                      </span>
                      <input
                        id="checkout-phone"
                        type="tel"
                        value={identification.phone}
                        onChange={(e) =>
                          setIdentification((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="(11) 96123-4567"
                        className="min-w-0 flex-1 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="w-full rounded-md uppercase tracking-wide"
                    onClick={handleIdentificationContinue}
                  >
                    Continuar para entrega
                  </Button>
                </div>
              )}
            </CheckoutStepCard>

            <CheckoutStepCard
              step={2}
              title="Entrega"
              subtitle="Informe o endereço de entrega."
              status={stepStatus(2, currentStep)}
              summary={<p>{formatAddressSummary(addressForm)}</p>}
              onEdit={() => setCurrentStep(2)}
            >
              <div className="space-y-4">
                {deliveryError && <Alert type="error">{deliveryError}</Alert>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="CEP"
                    value={addressForm.zip_code}
                    onChange={(e) => updateAddressField('zip_code', e.target.value)}
                    placeholder="00000-000"
                    required
                    autoComplete="postal-code"
                  />
                  <Input
                    label="Rua"
                    value={addressForm.street}
                    onChange={(e) => updateAddressField('street', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                    className="sm:col-span-2"
                    required
                    autoComplete="address-line1"
                  />
                  <Input
                    label="Número"
                    value={addressForm.number}
                    onChange={(e) => updateAddressField('number', e.target.value)}
                    required
                  />
                  <Input
                    label="Complemento"
                    value={addressForm.complement}
                    onChange={(e) => updateAddressField('complement', e.target.value)}
                    placeholder="Apto, bloco…"
                    autoComplete="address-line2"
                  />
                  <Input
                    label="Bairro"
                    value={addressForm.neighborhood}
                    onChange={(e) => updateAddressField('neighborhood', e.target.value)}
                    placeholder="Seu bairro"
                    required
                  />
                  <Input
                    label="Cidade"
                    value={addressForm.city}
                    onChange={(e) => updateAddressField('city', e.target.value)}
                    required
                    autoComplete="address-level2"
                  />
                  <Input
                    label="Estado"
                    value={addressForm.state}
                    onChange={(e) => updateAddressField('state', e.target.value)}
                    placeholder="UF"
                    maxLength={2}
                    required
                    autoComplete="address-level1"
                  />
                </div>

                {(shippingLoading || shippingOptions.length > 0 || shippingError) && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-text-primary">Forma de frete</p>
                    {shippingLoading && (
                      <p className="text-sm text-text-secondary">Calculando frete…</p>
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

                <Button
                  type="button"
                  className="w-full rounded-md uppercase tracking-wide"
                  disabled={shippingLoading}
                  onClick={handleDeliveryContinue}
                >
                  Continuar para pagamento
                </Button>

                <p className="text-xs text-text-muted">
                  Confira atentamente seus dados — o endereço de entrega não pode ser alterado após
                  o envio do pedido.
                </p>
              </div>
            </CheckoutStepCard>

            <CheckoutStepCard
              step={3}
              title="Pagamento"
              subtitle="Escolha Pix ou cartão e finalize na loja."
              status={stepStatus(3, currentStep)}
              onEdit={() => setCurrentStep(3)}
            >
              <div className="space-y-4">
                {paymentConfig?.pixDiscount ? (
                  <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
                    {paymentConfig.pixDiscount}% de desconto no Pix
                  </div>
                ) : null}

                <Input
                  label="CPF"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  disabled={Boolean(pixResult)}
                />

                {!pixResult && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {paymentConfig?.pixEnabled !== false && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                          paymentMethod === 'pix'
                            ? 'border-brand bg-brand/5 text-brand'
                            : 'border-border bg-surface text-text-primary hover:border-brand/40'
                        }`}
                      >
                        Pix
                        {pixDiscountPercent > 0 ? (
                          <span className="mt-0.5 block text-xs font-normal text-success">
                            {pixDiscountPercent}% off
                          </span>
                        ) : null}
                      </button>
                    )}
                    {paymentConfig?.cardEnabled !== false && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                          paymentMethod === 'card'
                            ? 'border-brand bg-brand/5 text-brand'
                            : 'border-border bg-surface text-text-primary hover:border-brand/40'
                        }`}
                      >
                        Cartão de crédito
                      </button>
                    )}
                  </div>
                )}

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">Entrega</dt>
                    <dd className="text-right text-text-primary">
                      {selectedShipping?.name ?? '—'}
                    </dd>
                  </div>
                  {pixDiscountAmount > 0 && (
                    <div className="flex justify-between gap-4 text-success">
                      <dt>Desconto Pix</dt>
                      <dd className="tabular-nums">− {formatCurrency(pixDiscountAmount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">Total do pedido</dt>
                    <dd className="font-bold tabular-nums text-success">{formatCurrency(total)}</dd>
                  </div>
                </dl>

                {pixResult ? (
                  <CheckoutPixPanel
                    total={pixResult.total}
                    discountAmount={pixResult.discountAmount}
                    qrCode={pixResult.qrCode}
                    qrImage={pixResult.qrImage}
                    expiresAt={pixResult.expiresAt}
                    polling={pixPolling}
                    onRefresh={() => pollPaymentStatus(pixResult.orderId)}
                  />
                ) : paymentMethod === 'pix' ? (
                  <Button
                    type="button"
                    className="w-full rounded-md uppercase tracking-wide"
                    loading={submitting}
                    disabled={
                      cartLoading ||
                      submitting ||
                      !selectedShippingId ||
                      availableLines.length === 0 ||
                      paymentConfig?.pixEnabled === false
                    }
                    onClick={handlePixPayment}
                  >
                    Gerar QR Code Pix
                  </Button>
                ) : (
                  <PayoutCardForm
                    total={total}
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
                )}

                <p className="text-center text-xs text-text-muted">
                  Pagamento processado com segurança via PayoutBR — dados do cartão não passam pelo
                  nosso servidor.
                </p>
              </div>
            </CheckoutStepCard>
          </div>

          <CheckoutOrderSummary
            lines={availableLines}
            subtotal={subtotal}
            loading={cartLoading}
            selectedShipping={selectedShipping}
            shippingLoading={shippingLoading && currentStep >= 2}
            discountAmount={pixDiscountAmount}
            total={total}
          />
        </div>

        <CheckoutSecurityBadges />
      </div>
    </div>
  )
}
