import type { VenoProduct } from '@/lib/veno/client'

type ProductLineInput = {
  productId: string
  name: string
  quantity: number
  /** Total da linha em reais (já com desconto de kit, se houver). */
  lineTotalReais: number
}

/**
 * Monta `products[]` da Veno com soma (price × qty) === amountCents.
 * Frete e desconto (Pix/kit) são absorvidos nos preços unitários.
 */
export function buildVenoProducts(params: {
  lines: ProductLineInput[]
  shippingReais: number
  totalCents: number
}): VenoProduct[] {
  const { totalCents } = params
  if (totalCents < 1) {
    return [{ external_ref: 'order', name: 'Pedido', price: 1, quantity: 1 }]
  }

  type SoftLine = { external_ref: string; name: string; quantity: number; lineCents: number }

  const soft: SoftLine[] = params.lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      external_ref: l.productId.slice(0, 64),
      name: (l.name.trim() || 'Produto').slice(0, 120),
      quantity: l.quantity,
      lineCents: Math.max(0, Math.round(l.lineTotalReais * 100)),
    }))

  const shippingCents = Math.max(0, Math.round(params.shippingReais * 100))
  if (shippingCents > 0) {
    soft.push({
      external_ref: 'shipping',
      name: 'Frete',
      quantity: 1,
      lineCents: shippingCents,
    })
  }

  if (soft.length === 0) {
    return [{ external_ref: 'order', name: 'Pedido', price: totalCents, quantity: 1 }]
  }

  let sum = soft.reduce((s, l) => s + l.lineCents, 0)

  // Ajusta para bater o total (desconto Pix/kit reduz; arredondamento sobe/desce 1 cent)
  if (sum !== totalCents && sum > 0) {
    const scale = totalCents / sum
    let allocated = 0
    for (let i = 0; i < soft.length; i++) {
      const line = soft[i]!
      if (i === soft.length - 1) {
        line.lineCents = Math.max(line.quantity, totalCents - allocated)
      } else {
        line.lineCents = Math.max(line.quantity, Math.round(line.lineCents * scale))
        allocated += line.lineCents
      }
    }
    sum = soft.reduce((s, l) => s + l.lineCents, 0)
    const drift = totalCents - sum
    if (drift !== 0) {
      const target = soft.find((l) => l.lineCents + drift >= l.quantity) ?? soft[soft.length - 1]!
      target.lineCents = Math.max(target.quantity, target.lineCents + drift)
    }
  }

  return soft.map((l) => ({
    external_ref: l.external_ref,
    name: l.name,
    quantity: l.quantity,
    price: Math.max(1, Math.round(l.lineCents / l.quantity)),
  })).map((p, idx, arr) => {
    // Re-check sum after integer division; fix last item unit price if needed
    if (idx < arr.length - 1) return p
    const sumExceptLast = arr.slice(0, -1).reduce((s, x) => s + x.price * x.quantity, 0)
    const need = totalCents - sumExceptLast
    const unit = Math.max(1, Math.round(need / p.quantity))
    return { ...p, price: unit }
  })
}

/** Garante soma exata após eventuais arredondamentos. */
export function assertVenoProductsSum(products: VenoProduct[], amountCents: number): VenoProduct[] {
  if (amountCents < 1) {
    return [{ external_ref: 'order', name: 'Pedido', price: 1, quantity: 1 }]
  }

  const sum = products.reduce((s, p) => s + p.price * p.quantity, 0)
  if (sum === amountCents && products.length > 0) return products

  if (products.length === 0) {
    return [{ external_ref: 'order', name: 'Pedido', price: amountCents, quantity: 1 }]
  }

  const withoutLast = products.slice(0, -1)
  const rest = withoutLast.reduce((s, p) => s + p.price * p.quantity, 0)
  const need = amountCents - rest

  if (need >= 1) {
    const last = products[products.length - 1]!
    return [
      ...withoutLast,
      {
        external_ref: last.external_ref,
        name: last.name,
        quantity: 1,
        price: need,
      },
    ]
  }

  return [{ external_ref: 'order', name: products[0]!.name, price: amountCents, quantity: 1 }]
}
