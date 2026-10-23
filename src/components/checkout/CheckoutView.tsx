'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, QrCode } from 'lucide-react'
import { CheckoutOrderSummary } from '@/components/checkout/CheckoutOrderSummary'
import { CheckoutPolicyNotice } from '@/components/checkout/CheckoutPolicyNotice'
import { CheckoutStepCard } from '@/components/checkout/CheckoutStepCard'
import { PaymentMethodsImage } from '@/components/payment/PaymentMethodsImage'
import { CheckoutPixPanel } from '@/components/checkout/CheckoutPixPanel'
import { CardUnavailablePanel } from '@/components/checkout/CardUnavailablePanel'
import { CheckoutSecurityBadges } from '@/components/checkout/CheckoutSecurityBadges'
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper'
import { CheckoutTopBar } from '@/components/checkout/CheckoutTopBar'
import { PixDiscountBadge } from '@/components/product/PixDiscountBadge'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchApi } from '@/lib/api/fetch-api'
import {
  guestOrderHeaders,
  guestOrderQuery,
  readGuestOrderToken,
  storeGuestOrderToken,
} from '@/lib/checkout/guest-access'
import {
  clearActivePix,
  isLocallyExpired,
  listPendingOrders,
  pendingOrderUrl,
  pushPendingOrder,
  readActivePix,
  removePendingOrder,
  saveActivePix,
  type PendingOrderEntry,
} from '@/lib/checkout/pix-session-storage'
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
import { ARRIVAL_WINDOW_NOTE } from '@/lib/shipping/arrival-window'
import { useCartSync } from '@/hooks/useCartSync'
import { useCart } from '@/providers/CartProvider'
import type { CheckoutPaymentSettings, PaymentSettings } from '@/types/payment'
import type { StoreLogo } from '@/types/layout'
import type { ShippingQuoteLine } from '@/types/shipping'

type Profile = {
  name: string
  email: string
  phone: string | null
  cpf?: string | null
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
type CheckoutStep = 1 | 2 | 3

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
  const { items, bundlePairs, clearCart } = useCart()
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice>('pix')
  const [step, setStep] = useState<CheckoutStep>(1)
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
  const [pixCancelled, setPixCancelled] = useState(false)
  const [restoringPix, setRestoringPix] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<PendingOrderEntry[]>([])

  const availableLines = useMemo(
    () => cart?.lines.filter((line) => line.available && line.quantity > 0) ?? [],
    [cart]
  )

  const selectedShipping = shippingOptions.find((o) => o.methodId === selectedShippingId) ?? null
  const shippingPrice = selectedShipping?.price ?? 0
  const merchandiseTotal = cart?.merchandiseTotal ?? cart?.subtotal ?? 0
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const merchandiseAfterCoupon = Math.max(merchandiseTotal - couponDiscount, 0)
  const bundleDiscountAmount = cart?.bundleDiscountAmount ?? 0
  const pixDiscountPercent = paymentConfig?.pixDiscount ?? 0
  const pixDiscountAmount =
    paymentMethod === 'pix'
      ? calcPixDiscountAmount(merchandiseAfterCoupon, shippingPrice, pixDiscountPercent)
      : 0
  const total = Math.max(merchandiseAfterCoupon + shippingPrice - pixDiscountAmount, 0)

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
      if (profileData.cpf) {
        setCpf(formatCpfInput(profileData.cpf))
      }
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
      }>('/api/checkout/config')

      if (data?.checkout) {
        setPaymentConfig(data.checkout)
        // Sempre inicia no Pix: é o único método processável no momento.
        setPaymentMethod('pix')
      }
    }

    loadProfile()
    loadAddresses()
    loadPaymentConfig()
    // Acorda o provedor de Pix enquanto o cliente preenche os dados.
    fetchApi('/api/checkout/warmup', { method: 'POST' })
  }, [])

  // Restaura um Pix em andamento (ex.: após reload) sem confiar apenas no
  // localStorage — sempre revalida com o servidor antes de exibir algo.
  useEffect(() => {
    let active = true

    async function restore() {
      const stored = readActivePix()
      if (!stored) {
        setPendingOrders(listPendingOrders())
        setRestoringPix(false)
        return
      }

      if (stored.guestToken) {
        storeGuestOrderToken(stored.orderId, stored.guestToken)
      }

      if (isLocallyExpired(stored.expiresAt)) {
        clearActivePix()
        if (active) {
          setPendingOrders(listPendingOrders())
          setRestoringPix(false)
        }
        return
      }

      const { data } = await fetchApi<{ status: string; orderStatus?: string | null }>(
        `/api/checkout/orders/${stored.orderId}/payment-status${guestOrderQuery(stored.orderId)}`,
        { headers: guestOrderHeaders(stored.orderId) }
      )

      if (!active) return

      if (!data) {
        // Não deu para revalidar (rede etc.) — não exibe um estado não confirmado.
        clearActivePix()
        setPendingOrders(listPendingOrders())
        setRestoringPix(false)
        return
      }

      if (data.status === 'paid') {
        clearActivePix()
        clearCart()
        router.replace(`/pedido/${stored.orderId}/obrigado${guestOrderQuery(stored.orderId)}`)
        return
      }

      if (data.orderStatus === 'cancelled') {
        clearActivePix()
        setSubmitError(
          'Seu pagamento Pix anterior expirou ou foi cancelado. Você pode gerar um novo agora.'
        )
        setPendingOrders(listPendingOrders())
        setRestoringPix(false)
        return
      }

      setPixResult({
        orderId: stored.orderId,
        total: stored.total,
        discountAmount: stored.discountAmount,
        qrCode: stored.qrCode,
        qrImage: stored.qrImage,
        expiresAt: stored.expiresAt,
      })
      setPendingOrders(listPendingOrders())
      setRestoringPix(false)
    }

    restore()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (cep.length === 8 && merchandiseTotal > 0) {
      loadShipping(cep, merchandiseTotal)
    }
  }, [addressForm.zip_code, merchandiseTotal, loadShipping])

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

  function buildCheckoutPayload() {
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
      bundle_pairs: bundlePairs.map((pair) => ({
        primary_product_id: pair.primaryProductId,
        companion_product_id: pair.companionProductId,
        discount_percent: pair.discountPercent,
      })),
      coupon_code: couponCode || undefined,
    }
  }

  const pollPaymentStatus = useCallback(
    async (orderId: string): Promise<{ paid: boolean; cancelled: boolean }> => {
      const { data } = await fetchApi<{ status: string; orderStatus?: string | null }>(
        `/api/checkout/orders/${orderId}/payment-status${guestOrderQuery(orderId)}`,
        { headers: guestOrderHeaders(orderId) }
      )
      return {
        paid: data?.status === 'paid',
        cancelled: data?.orderStatus === 'cancelled',
      }
    },
    []
  )

  useEffect(() => {
    if (!pixResult?.orderId || restoringPix) return

    let active = true
    setPixPolling(true)
    setPixCancelled(false)
    const startedAt = Date.now()
    const MAX_POLL_MS = 10 * 60 * 1000
    let delay = 4000
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function check() {
      if (!active) return
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setPixPolling(false)
        return
      }
      const result = await pollPaymentStatus(pixResult!.orderId)
      if (!active) return
      if (result.paid) {
        clearActivePix()
        clearCart()
        setPixPolling(false)
        router.push(`/pedido/${pixResult!.orderId}/obrigado${guestOrderQuery(pixResult!.orderId)}`)
        return
      }
      if (result.cancelled) {
        clearActivePix()
        setPixPolling(false)
        setPixCancelled(true)
        return
      }
      delay = Math.min(delay + 1000, 15000)
      timeoutId = setTimeout(check, delay)
    }

    check()

    return () => {
      active = false
      if (timeoutId) clearTimeout(timeoutId)
      setPixPolling(false)
    }
  }, [pixResult, restoringPix, pollPaymentStatus, clearCart, router])

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

    setPixCancelled(false)
    setPixResult({
      orderId: data.orderId,
      total: data.total,
      discountAmount: data.discountAmount,
      qrCode: data.qrCode,
      qrImage: data.qrImage,
      expiresAt: data.expiresAt,
    })
    saveActivePix({
      orderId: data.orderId,
      guestToken: data.guestAccessToken ?? null,
      total: data.total,
      discountAmount: data.discountAmount,
      qrCode: data.qrCode,
      qrImage: data.qrImage,
      expiresAt: data.expiresAt,
      createdAt: new Date().toISOString(),
    })
  }

  /**
   * Deixa o Pix atual como está (segue válido e pagável pelo link salvo)
   * e libera a tela de checkout para um pedido novo — ex.: o cliente quer
   * comprar mais itens ou fazer um pedido diferente sem perder o pagamento
   * anterior.
   */
  function handleStartNewOrder() {
    if (pixResult) {
      pushPendingOrder({
        orderId: pixResult.orderId,
        guestToken: readGuestOrderToken(pixResult.orderId),
        total: pixResult.total,
        expiresAt: pixResult.expiresAt,
        createdAt: new Date().toISOString(),
      })
    }
    clearActivePix()
    setPixResult(null)
    setPixCancelled(false)
    setPixPolling(false)
    setPendingOrders(listPendingOrders())
    setSubmitError(null)
  }

  function handleDismissPendingOrder(orderId: string) {
    removePendingOrder(orderId)
    setPendingOrders(listPendingOrders())
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
      setStep(1)
      setIdentificationFieldErrors(idResult.errors)
      const first = Object.values(idResult.errors)[0]
      if (first) setIdentificationError(first)
      return
    }

    const addressResult = validateCheckoutAddress(addressForm)
    if (!addressResult.ok) {
      setStep(2)
      setAddressFieldErrors(addressResult.errors)
      setDeliveryError(addressResult.message)
      return
    }

    let shippingId = selectedShippingId
    if (!shippingId && !shippingLoading) {
      const cep = addressForm.zip_code.replace(/\D/g, '')
      if (cep.length === 8) {
        const quoted = await loadShipping(cep, merchandiseTotal)
        shippingId = quoted?.methodId ?? null
      }
    }

    if (!shippingId) {
      setStep(2)
      setDeliveryError('Selecione uma forma de frete')
      return
    }

    setSelectedShippingId(shippingId)

    const cpfResult = validateCheckoutCpf(cpf)
    if (!cpfResult.ok) {
      setStep(3)
      setCpfError(cpfResult.message)
      return
    }

    if (pixResult) return

    if (paymentMethod === 'card') {
      setSubmitError('Pagamento com cartão indisponível. Selecione Pix para concluir.')
      return
    }

    await handlePixPayment()
  }

  function continueToDelivery() {
    setSubmitError(null)
    setIdentificationError(null)
    const idResult = validateCheckoutIdentification(identification)
    if (!idResult.ok) {
      setIdentificationFieldErrors(idResult.errors)
      const first = Object.values(idResult.errors)[0]
      if (first) setIdentificationError(first)
      return
    }
    setIdentificationFieldErrors({})
    setStep(2)
  }

  function continueToPayment() {
    setSubmitError(null)
    setDeliveryError(null)
    const addressResult = validateCheckoutAddress(addressForm)
    if (!addressResult.ok) {
      setAddressFieldErrors(addressResult.errors)
      setDeliveryError(addressResult.message)
      return
    }
    if (shippingLoading || cepLoading) {
      setDeliveryError('Aguarde o cálculo do frete')
      return
    }
    if (!selectedShippingId) {
      setDeliveryError('Informe o CEP e escolha uma forma de frete')
      return
    }
    setAddressFieldErrors({})
    setStep(3)
  }

  const activeStep: CheckoutStep = pixResult ? 3 : step

  function stepStatus(target: CheckoutStep): 'pending' | 'active' | 'completed' {
    if (activeStep === target) return 'active'
    if (activeStep > target) return 'completed'
    return 'pending'
  }

  const isEmpty = items.length === 0 && !cartLoading

  const summaryAction =
    activeStep === 1
      ? {
          onFinalize: pixResult ? undefined : continueToDelivery,
          finalizeDisabled: profileLoading,
          finalizeLabel: 'Continuar para entrega',
          finalizeLoading: false,
        }
      : activeStep === 2
        ? {
            onFinalize: pixResult ? undefined : continueToPayment,
            finalizeDisabled: shippingLoading || cepLoading,
            finalizeLabel: 'Continuar para pagamento',
            finalizeLoading: false,
          }
        : {
            onFinalize: pixResult ? undefined : handleFinalizeOrder,
            finalizeDisabled:
              cartLoading ||
              submitting ||
              restoringPix ||
              availableLines.length === 0 ||
              paymentMethod === 'card' ||
              paymentConfig?.pixEnabled === false,
            finalizeLabel: 'Finalizar pedido',
            finalizeLoading: submitting,
          }

  const summaryProps = {
    lines: availableLines,
    subtotal: cart?.subtotal ?? 0,
    bundleDiscountAmount,
    loading: cartLoading,
    selectedShipping,
    shippingLoading,
    discountAmount: pixDiscountAmount,
    onCouponChange: (applied: { code: string; discountAmount: number }) => {
      setCouponCode(applied.code)
      setCouponDiscount(applied.discountAmount)
    },
    total,
    onFinalize: summaryAction.onFinalize,
    finalizeDisabled: summaryAction.finalizeDisabled,
    finalizeLoading: summaryAction.finalizeLoading,
    finalizeLabel: summaryAction.finalizeLabel,
    hideFinalizeOnMobile: true,
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
        <CheckoutStepper currentStep={activeStep} />

        {restoringPix && (
          <div className="mt-6">
            <Alert type="info">Verificando se há um pagamento em andamento...</Alert>
          </div>
        )}

        {(cartError || submitError) && (
          <div className="mt-6 space-y-2">
            {cartError && <Alert type="error">{cartError}</Alert>}
            {submitError && <Alert type="error">{submitError}</Alert>}
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <CheckoutStepCard
              step={1}
              title="Seus dados"
              subtitle="Usamos nome, e-mail e celular só para confirmar o pedido."
              status={stepStatus(1)}
              onEdit={pixResult ? undefined : () => setStep(1)}
              summary={
                <div className="space-y-0.5">
                  <p className="font-medium text-text-primary">{identification.name}</p>
                  <p>{identification.email}</p>
                  <p>{identification.phone}</p>
                </div>
              }
            >
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
                      Celular
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
              <div className="mt-5">
                <Button
                  type="button"
                  className="w-full rounded-md py-3 text-sm font-bold"
                  onClick={continueToDelivery}
                  disabled={profileLoading}
                >
                  Continuar para entrega
                </Button>
              </div>
            </CheckoutStepCard>

            <CheckoutStepCard
              step={2}
              title="Entrega"
              subtitle="O CEP mostra o prazo e o valor do frete antes do pagamento."
              status={stepStatus(2)}
              onEdit={pixResult ? undefined : () => setStep(2)}
              summary={
                <div className="space-y-0.5">
                  <p className="font-medium text-text-primary">
                    {addressForm.street}, {addressForm.number}
                    {addressForm.complement ? ` — ${addressForm.complement}` : ''}
                  </p>
                  <p>
                    {addressForm.neighborhood} — {addressForm.city}/{addressForm.state} · CEP{' '}
                    {addressForm.zip_code}
                  </p>
                  {selectedShipping ? (
                    <p>
                      {selectedShipping.name} ·{' '}
                      {selectedShipping.isFree ? 'Grátis' : formatCurrency(selectedShipping.price)}
                    </p>
                  ) : null}
                </div>
              }
            >
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
                                      {option.arrivalLabel
                                        ? `${option.deliveryLabel} em trânsito`
                                        : option.deliveryLabel}
                                    </p>
                                    {option.arrivalLabel ? (
                                      <p className="mt-0.5 text-xs font-medium text-text-primary">
                                        {option.arrivalLabel}
                                      </p>
                                    ) : null}
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
                    {shippingOptions.some((option) => option.arrivalLabel) ? (
                      <p className="text-[11px] leading-relaxed text-text-muted">{ARRIVAL_WINDOW_NOTE}</p>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-md"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-md py-3 text-sm font-bold"
                  onClick={continueToPayment}
                  disabled={shippingLoading || cepLoading}
                >
                  Continuar para pagamento
                </Button>
              </div>
            </CheckoutStepCard>

            <CheckoutStepCard
              step={3}
              title="Pagamento"
              subtitle="Confira o total no resumo e finalize com Pix."
              status={stepStatus(3)}
            >
              <div className="space-y-4">
                {paymentConfig?.pixDiscount ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand/25 bg-brand/5 px-4 py-3">
                    <PixDiscountBadge percent={paymentConfig.pixDiscount} />
                    <p className="text-sm text-text-secondary">
                      Pague com Pix e aproveite o desconto no total do pedido.
                    </p>
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
                    <div
                      className={`rounded-md border transition-colors ${
                        paymentMethod === 'card' ? 'border-amber-400' : 'border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`size-4 shrink-0 rounded-full border ${
                              paymentMethod === 'card'
                                ? 'border-amber-500 bg-amber-500'
                                : 'border-border-strong bg-surface'
                            }`}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-text-primary">
                              Pagar com cartão de crédito
                            </span>
                            <span className="mt-0.5 block text-xs font-medium text-amber-800">
                              Indisponível no momento
                            </span>
                          </span>
                        </span>
                        <CreditCard className="size-5 shrink-0 text-text-muted" aria-hidden />
                      </button>
                      {paymentMethod === 'card' && (
                        <div className="border-t border-border px-4 pb-4 pt-3">
                          <CardUnavailablePanel onUsePix={() => setPaymentMethod('pix')} />
                        </div>
                      )}
                    </div>

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
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-text-primary">
                                Pagar com Pix
                              </span>
                              {pixDiscountPercent > 0 && (
                                <PixDiscountBadge percent={pixDiscountPercent} />
                              )}
                            </span>
                          </span>
                          <QrCode className="size-5 shrink-0 text-text-muted" aria-hidden />
                        </button>
                        {paymentMethod === 'pix' && (
                          <div className="border-t border-border px-4 pb-4 pt-3">
                            <ol className="list-decimal space-y-1 pl-4 text-xs text-text-secondary">
                              <li>Clique em Finalizar pedido.</li>
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
                    orderId={pixResult.orderId}
                    total={pixResult.total}
                    discountAmount={pixResult.discountAmount}
                    qrCode={pixResult.qrCode}
                    qrImage={pixResult.qrImage}
                    expiresAt={pixResult.expiresAt}
                    polling={pixPolling}
                    cancelled={pixCancelled}
                    onStartNewOrder={handleStartNewOrder}
                    proofSource="checkout"
                    useGuestAccess
                    onRefresh={async () => {
                      const result = await pollPaymentStatus(pixResult.orderId)
                      if (result.paid) {
                        clearActivePix()
                        clearCart()
                        router.push(
                          `/pedido/${pixResult.orderId}/obrigado${guestOrderQuery(pixResult.orderId)}`
                        )
                        return true
                      }
                      if (result.cancelled) {
                        clearActivePix()
                        setPixCancelled(true)
                      }
                      return false
                    }}
                  />
                )}

                {!pixResult && pendingOrders.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border bg-surface-muted/30 p-4">
                    <p className="text-sm font-semibold text-text-primary">
                      Pagamento(s) pendente(s)
                    </p>
                    <p className="text-xs text-text-secondary">
                      Você ainda pode concluir estes pedidos — eles continuam válidos.
                    </p>
                    <ul className="space-y-2">
                      {pendingOrders.map((entry) => (
                        <li
                          key={entry.orderId}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {formatCurrency(entry.total)}
                            </p>
                            <p className="text-xs text-text-muted">Pedido #{entry.orderId.slice(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={pendingOrderUrl(entry)}
                              className="text-xs font-semibold text-brand underline-offset-2 hover:underline"
                            >
                              Pagar agora
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDismissPendingOrder(entry.orderId)}
                              className="text-xs text-text-muted hover:text-text-secondary"
                              aria-label="Dispensar"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
              {!pixResult && (
                <div className="mt-5 space-y-3 lg:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-md px-0"
                    onClick={() => setStep(2)}
                  >
                    Voltar para entrega
                  </Button>
                  <CheckoutPolicyNotice />
                  <Button
                    type="button"
                    className="w-full rounded-md py-3 text-sm font-bold uppercase tracking-wide"
                    loading={submitting}
                    disabled={
                      cartLoading ||
                      submitting ||
                      restoringPix ||
                      availableLines.length === 0 ||
                      paymentMethod === 'card' ||
                      paymentConfig?.pixEnabled === false
                    }
                    onClick={() => void handleFinalizeOrder()}
                  >
                    Finalizar pedido
                  </Button>
                </div>
              )}
            </CheckoutStepCard>
          </div>

          <div>
            <CheckoutOrderSummary {...summaryProps} />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <PaymentMethodsImage size="lg" />
        </div>

        <CheckoutSecurityBadges />
      </div>
    </div>
  )
}
