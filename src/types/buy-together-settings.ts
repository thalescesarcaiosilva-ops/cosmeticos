export type BuyTogetherCssSettings = {
  sectionBackground: string
  sectionBorderColor: string
  sectionBorderRadius: string
  titleColor: string
  subtitleColor: string
  priceColor: string
  badgeBackground: string
  badgeTextColor: string
  buttonBackground: string
  buttonTextColor: string
  savingsColor: string
  customCss: string
}

export type BuyTogetherSettings = {
  enabled: boolean
  defaultDiscountPercent: number
  maxBundleTotal: number
  title: string
  eyebrow: string
  subtitleFallback: string
  ctaLabel: string
  ctaAddedLabel: string
  css: BuyTogetherCssSettings
}

export const DEFAULT_BUY_TOGETHER_CSS: BuyTogetherCssSettings = {
  sectionBackground: '',
  sectionBorderColor: '',
  sectionBorderRadius: '',
  titleColor: '',
  subtitleColor: '',
  priceColor: '',
  badgeBackground: '',
  badgeTextColor: '',
  buttonBackground: '',
  buttonTextColor: '',
  savingsColor: '',
  customCss: '',
}

export const DEFAULT_BUY_TOGETHER_SETTINGS: BuyTogetherSettings = {
  enabled: true,
  defaultDiscountPercent: 5,
  maxBundleTotal: 498,
  title: 'Compre junto',
  eyebrow: 'Oferta',
  subtitleFallback: 'Combine com outro produto e economize.',
  ctaLabel: 'Comprar os 2 itens',
  ctaAddedLabel: 'Adicionados!',
  css: DEFAULT_BUY_TOGETHER_CSS,
}
