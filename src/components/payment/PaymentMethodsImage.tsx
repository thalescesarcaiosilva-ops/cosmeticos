import Image from 'next/image'
import {
  hasPaymentMethodsImage,
  paymentMethodsImageConfig,
} from '@/lib/payment/payment-methods-image'

type PaymentMethodsImageProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PaymentMethodsImage({ size = 'md', className = '' }: PaymentMethodsImageProps) {
  if (!hasPaymentMethodsImage()) return null

  const heightClass =
    size === 'sm' ? 'max-h-6' : size === 'lg' ? 'max-h-10' : 'max-h-8'

  return (
    <Image
      src={paymentMethodsImageConfig.imageUrl!}
      alt={paymentMethodsImageConfig.alt}
      width={360}
      height={48}
      className={`h-auto w-auto max-w-full object-contain ${heightClass} ${className}`}
    />
  )
}
