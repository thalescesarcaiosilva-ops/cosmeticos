import { MediaLibrary } from '@/components/admin/MediaLibrary'

export default function AdminMediaPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Envie imagens para produtos, site ou categorias. Produtos vão para a pasta de produtos; logos,
        ícones e selos vão para a pasta do site. Formatos: JPEG, PNG, WebP, GIF, SVG (máx. 5 MB).
      </p>
      <MediaLibrary showBucketFilter />
    </div>
  )
}
