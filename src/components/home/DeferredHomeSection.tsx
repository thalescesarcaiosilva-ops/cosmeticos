type DeferredHomeSectionProps = {
  children: React.ReactNode
  /** Altura estimada p/ evitar salto quando a seção entra na viewport. */
  estimatedHeightPx?: number
  className?: string
}

/**
 * Adia pintura/layout de seções abaixo da dobra sem remover o HTML do DOM.
 * Conteúdo já renderizado no SSR permanece montado (sem sumir ao rolar de volta).
 */
export function DeferredHomeSection({
  children,
  estimatedHeightPx = 520,
  className = '',
}: DeferredHomeSectionProps) {
  return (
    <div
      className={className}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${estimatedHeightPx}px`,
      }}
    >
      {children}
    </div>
  )
}
