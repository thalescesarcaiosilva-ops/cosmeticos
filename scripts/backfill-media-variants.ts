/**
 * Gera thumb/medium para mídias antigas. public_url canônico NÃO muda (Merchant seguro).
 * Uso: npm run backfill:media
 */
import { backfillMediaVariantsBatch, countMediaMissingVariants } from '../src/lib/media/backfill-variants'

const BATCH = 15
const MAX_ROUNDS = 500

async function main() {
  let remaining = await countMediaMissingVariants()
  console.log(`Mídias sem thumb/medium: ${remaining}`)

  if (remaining === 0) {
    console.log('Nada a fazer.')
    return
  }

  let round = 0
  let totalUpdated = 0

  while (remaining > 0 && round < MAX_ROUNDS) {
    round += 1
    const result = await backfillMediaVariantsBatch(BATCH)
    totalUpdated += result.updated
    remaining = result.remaining
    console.log(
      `Lote ${round}: +${result.updated} ok, ${result.failed} falhas, ${remaining} restantes`
    )
    if (result.updated === 0 && result.failed === 0) break
  }

  console.log(`Concluído: ${totalUpdated} mídias atualizadas, ${remaining} restantes.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
