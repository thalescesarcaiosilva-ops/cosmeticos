'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  IconCart,
  IconChevronLeft,
  IconChevronDown,
  IconCustomer,
  IconHeart,
  IconHelp,
  IconMenu,
  IconPhone,
  IconWhatsapp,
} from '@/components/icons/DotIcons'
import type {
  HelpLink,
  MenuCategory,
  PhoneContact,
  SocialLink,
  StoreLogo,
} from '@/types/layout'
import { useCart } from '@/providers/CartProvider'
import { useFavorites } from '@/providers/FavoritesProvider'
import { SearchBar } from './SearchBar'
import { ShippingPromoBar } from './ShippingPromoBar'
import { StoreLogoMark } from './StoreLogo'

type SiteHeaderProps = {
  storeName: string
  logo: StoreLogo
  menuCategories: MenuCategory[]
  phone: PhoneContact
  helpLink: HelpLink
  socialLinks: SocialLink[]
  overlay?: boolean
}

export function SiteHeader({
  storeName,
  logo,
  menuCategories,
  phone,
  helpLink,
  socialLinks,
  overlay = false,
}: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { itemCount: cartItemCount, hydrated } = useCart()
  const { favoriteCount, hydrated: favoritesHydrated } = useFavorites()
  const hasPhone = Boolean(phone.display.trim() && phone.href.trim())
  const hasHelp = Boolean(helpLink.label.trim() && helpLink.href.trim())
  const logoVariant = overlay ? 'light' : 'dark'

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <>
      <ShippingPromoBar className="md:hidden" overlay={overlay} />

      <div className="header-container">
        <header className="header mx-auto max-w-[1200px] px-4 md:px-6">
          <div className="flex items-center gap-3 py-3 md:gap-5 md:py-4">
            <button
              type="button"
              className={`logo__menu header-action flex size-9 shrink-0 items-center justify-center md:hidden ${
                overlay ? 'text-white' : 'text-text-primary'
              }`}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <IconMenu className="size-6" />
            </button>

            <div className="logo shrink-0">
              <StoreLogoMark logo={logo} storeName={storeName} variant={logoVariant} />
            </div>

            <div className="search hidden min-w-0 flex-1 overflow-visible md:block md:px-4 lg:px-8">
              <SearchBar overlay={overlay} />
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-4 lg:gap-5">
              {hasPhone && (
                <a
                  href={phone.href}
                  className={`nav__phone hidden items-center gap-1.5 text-sm font-bold transition-opacity duration-[400ms] hover:opacity-80 lg:flex ${
                    overlay ? 'text-white' : 'text-text-primary'
                  }`}
                  aria-label={`Telefone ${phone.display}`}
                >
                  <IconPhone className="size-5 shrink-0" />
                  <span>
                    <span>{phone.areaCode}</span>
                    {phone.number}
                  </span>
                </a>
              )}

              {hasHelp && (
                <Link
                  href={helpLink.href}
                  className={`-ajuda hidden items-center gap-1.5 text-sm font-bold transition-opacity duration-[400ms] hover:opacity-80 lg:flex ${
                    overlay ? 'text-white' : 'text-text-primary'
                  }`}
                >
                  <IconHelp className="size-5 shrink-0" />
                  <span>{helpLink.label}</span>
                </Link>
              )}

             

              {hasHelp && (
                <Link
                  href={helpLink.href}
                  className="header-action flex size-9 items-center justify-center lg:hidden"
                  aria-label={helpLink.label}
                >
                  <IconHelp className="size-6" />
                </Link>
              )}

              <div className="relative">
                <Link
                  href="/favoritos"
                  className="header-action flex size-9 items-center justify-center transition-opacity duration-[400ms] hover:opacity-80"
                  aria-label={`Favoritos${favoriteCount > 0 ? `, ${favoriteCount} itens` : ''}`}
                >
                  <IconHeart className="size-6" />
                </Link>
                {favoritesHydrated && favoriteCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {favoriteCount > 9 ? '9+' : favoriteCount}
                  </span>
                )}
              </div>

              <div className="myaccount">
                <Link
                  href="/conta"
                  className="myaccount__hi header-action flex size-9 items-center justify-center transition-opacity duration-[400ms] hover:opacity-80"
                  aria-label="Minha conta"
                >
                  <IconCustomer className="size-6" />
                </Link>
              </div>

              <div className="mycart relative">
                <Link
                  href="/carrinho"
                  className="mycart__link header-action flex size-9 items-center justify-center transition-opacity duration-[400ms] hover:opacity-80"
                  title="Meu Carrinho"
                  aria-label={`Meu Carrinho${cartItemCount > 0 ? `, ${cartItemCount} itens` : ''}`}
                >
                  <IconCart className="size-6" />
                </Link>
                {hydrated && cartItemCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="search overflow-visible pb-3 md:hidden">
            <SearchBar id="search-mobile" variant="mobile" overlay={overlay} />
          </div>
        </header>
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <aside
            className="fixed inset-y-0 left-0 z-[70] flex w-[min(100%,340px)] flex-col bg-surface shadow-2xl md:hidden"
            aria-label="Menu principal"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <button
                type="button"
                className="flex size-10 items-center justify-center text-brand"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Voltar"
              >
                <IconChevronLeft className="size-7" />
              </button>
              <Link
                href="/conta"
                className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white transition-opacity duration-[400ms] hover:opacity-95"
                onClick={() => setMobileMenuOpen(false)}
              >
                <IconCustomer className="size-5" />
                Minha conta
              </Link>
            </div>

            <nav className="flex-1 overflow-y-auto">
              <ul>
                {menuCategories.map((category) => (
                  <li key={category.id} className="border-b border-border/80">
                    <Link
                      href={category.href}
                      className="flex items-center justify-between px-4 py-4 text-[14px] font-bold text-text-primary transition-colors hover:bg-surface-muted"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>{category.label}</span>
                      {category.hasDropdown && (
                        <IconChevronDown className="size-4 text-text-muted" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </>
      )}
    </>
  )
}
