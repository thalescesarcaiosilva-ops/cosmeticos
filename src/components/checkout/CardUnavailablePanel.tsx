import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

type CardUnavailablePanelProps = {
  onUsePix: () => void
}

/** Aviso só do checkout: a cobrança com cartão não está disponível; o Pix segue ativo. */
export function CardUnavailablePanel({ onUsePix }: CardUnavailablePanelProps) {
  return (
    <div className="space-y-3">
      <Alert type="warning">
        <p className="font-semibold">Cartão indisponível no momento</p>
        <p className="mt-1">
          O pagamento com cartão de crédito não está disponível agora. Use o Pix para concluir este pedido.
        </p>
      </Alert>
      <Button type="button" className="w-full rounded-md py-3 text-sm font-bold" onClick={onUsePix}>
        Pagar com Pix
      </Button>
    </div>
  )
}
