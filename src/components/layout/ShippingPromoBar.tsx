type ShippingPromoBarProps = {
  className?: string
  overlay?: boolean
}

export function ShippingPromoBar({ className = '', overlay = false }: ShippingPromoBarProps) {
  return (
    <div
      className={`flex items-center justify-center px-4 py-2 text-white transition-colors duration-[400ms] ${
        overlay ? 'bg-brand/90' : 'bg-brand'
      } ${className}`}
    >
      <p className="text-center text-[12px] font-bold md:text-sm">
        Frete grátis para pedidos acima de R$ 200
      </p>
    </div>
  )
}
