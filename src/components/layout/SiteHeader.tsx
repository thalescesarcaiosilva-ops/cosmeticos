'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  IconCart,
  IconCustomer,
  IconHeart,
  IconHelp,
  IconMenu,
  IconPackage,
  IconPhone,
} from '@/components/icons/DotIcons'
import type {
  ContactPageLink,
  HelpLink,
  MenuCategory,
  PhoneContact,
  SocialLink,
  StoreLogo,
} from '@/types/layout'
import { useCart } from '@/providers/CartProvider'
import { useFavorites } from '@/providers/FavoritesProvider'
import { MobileNavDrawer } from './MobileNavDrawer'
import { SearchBar } from './SearchBar'
import { StoreLogoMark } from './StoreLogo'

type SiteHeaderProps = {
  storeName: string
  logo: StoreLogo
  menuCategories: MenuCategory[]
  phone: PhoneContact
  helpLink: HelpLink
  contactPage: ContactPageLink
  socialLinks: SocialLink[]
  overlay?: boolean
}

export function SiteHeader({
  storeName,
  logo,
  menuCategories,
  phone,
  helpLink,
  contactPage,
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

      <div className="header-container">
        <header className="header mx-auto max-w-[1200px] px-4 md:px-6">
          <div className="flex items-center gap-2 py-2 md:gap-5 md:py-4">
            <button
              type="button"
              className={`logo__menu header-action flex size-8 shrink-0 items-center justify-center md:hidden ${
                overlay ? 'text-white' : 'text-text-primary'
              }`}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <IconMenu className="size-5" />
            </button>

            <div className="logo shrink-0">
              <StoreLogoMark logo={logo} storeName={storeName} variant={logoVariant} />
            </div>

            <div className="search hidden min-w-0 flex-1 overflow-visible md:block md:px-4 lg:px-8">
              <SearchBar overlay={overlay} />
            </div>

            <div className="ml-auto flex items-center gap-1 md:gap-4 lg:gap-5">
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

              <Link
                href="/paginas/rastreio"
                className={`hidden items-center gap-1.5 text-sm font-bold transition-opacity duration-[400ms] hover:opacity-80 lg:flex ${
                  overlay ? 'text-white' : 'text-text-primary'
                }`}
              >
                <IconPackage className="size-5 shrink-0" />
                <span>Rastreie seu Pedido</span>
              </Link>

              <Link
                href="/paginas/rastreio"
                className="header-action flex size-8 items-center justify-center md:size-9 lg:hidden"
                aria-label="Rastreie seu Pedido"
              >
                <IconPackage className="size-5 md:size-6" />
              </Link>

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
                  className="header-action flex size-8 items-center justify-center md:size-9 lg:hidden"
                  aria-label={helpLink.label}
                >
                  <IconHelp className="size-5 md:size-6" />
                </Link>
              )}

              <div className="relative">
                <Link
                  href="/favoritos"
                  className="header-action flex size-8 items-center justify-center transition-opacity duration-[400ms] hover:opacity-80 md:size-9"
                  aria-label={`Favoritos${favoriteCount > 0 ? `, ${favoriteCount} itens` : ''}`}
                >
                  <IconHeart className="size-5 md:size-6" />
                </Link>
                {favoritesHydrated && favoriteCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand px-0.5 text-[9px] font-bold text-white md:h-4 md:min-w-4 md:text-[10px]">
                    {favoriteCount > 9 ? '9+' : favoriteCount}
                  </span>
                )}
              </div>

              <div className="myaccount">
                <Link
                  href="/conta"
                  className="myaccount__hi header-action flex size-8 items-center justify-center transition-opacity duration-[400ms] hover:opacity-80 md:size-9"
                  aria-label="Minha conta"
                >
                  <IconCustomer className="size-5 md:size-6" />
                </Link>
              </div>

              <div className="mycart relative">
                <Link
                  href="/carrinho"
                  className="mycart__link header-action flex size-8 items-center justify-center transition-opacity duration-[400ms] hover:opacity-80 md:size-9"
                  title="Meu Carrinho"
                  aria-label={`Meu Carrinho${cartItemCount > 0 ? `, ${cartItemCount} itens` : ''}`}
                >
                  <IconCart className="size-5 md:size-6" />
                </Link>
                {hydrated && cartItemCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand px-0.5 text-[9px] font-bold text-white md:h-4 md:min-w-4 md:text-[10px]">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="search overflow-visible pb-2 md:hidden">
            <SearchBar id="search-mobile" variant="mobile" overlay={overlay} />
          </div>
        </header>
      </div>

      <MobileNavDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        menuCategories={menuCategories}
        contactPage={contactPage}
      />
    </>
  )
}
