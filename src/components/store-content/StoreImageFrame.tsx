import Image from 'next/image'
import { ImageIcon } from 'lucide-react'

type StoreImageFrameProps = {
  imageUrl: string | null
  alt: string
  className?: string
  priority?: boolean
}

/**
 * Exibe a foto da loja. Se `imageUrl` for null, mostra um espaço reservado
 * elegante orientando onde adicionar a imagem (via arquivo de configuração).
 */
export function StoreImageFrame({ imageUrl, alt, className, priority }: StoreImageFrameProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-plum/5 ring-1 ring-plum/10 ${className ?? ''}`}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(min-width: 768px) 600px, 100vw"
          quality={75}
          className="object-cover"
          priority={priority}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-cream via-white to-rose/10 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-plum/8 text-plum/50">
            <ImageIcon className="size-7" aria-hidden />
          </span>
          <p className="max-w-xs font-mono text-[0.7rem] uppercase tracking-[0.2em] text-plum/50">
            Adicione a foto da loja em <span className="text-plum/70">content.ts</span>
          </p>
        </div>
      )}
    </div>
  )
}
