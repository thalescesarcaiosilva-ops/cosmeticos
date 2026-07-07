import { CartProvider } from '@/providers/CartProvider'
import { FavoritesProvider } from '@/providers/FavoritesProvider'
import { SiteLayout, type ChromeMode } from './SiteLayout'

type ShopShellProps = {
  children: React.ReactNode
  chrome?: ChromeMode
}

export function ShopShell({ children, chrome }: ShopShellProps) {
  return (
    <CartProvider>
      <FavoritesProvider>
        {chrome ? <SiteLayout chrome={chrome}>{children}</SiteLayout> : children}
      </FavoritesProvider>
    </CartProvider>
  )
}
