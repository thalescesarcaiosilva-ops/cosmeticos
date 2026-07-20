import type { CSSProperties } from 'react'
import type { BuyTogetherCssSettings } from '@/types/buy-together-settings'

/** Remove trechos perigosos de CSS livre colado no admin. */
export function sanitizeBuyTogetherCustomCss(raw: string): string {
  return raw
    .replace(/<\/style/gi, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/-moz-binding/gi, '')
}

export function buildBuyTogetherCssVars(
  css: BuyTogetherCssSettings
): CSSProperties & Record<string, string> {
  const vars: Record<string, string> = {}

  if (css.sectionBackground) vars['--bt-bg'] = css.sectionBackground
  if (css.sectionBorderColor) vars['--bt-border'] = css.sectionBorderColor
  if (css.sectionBorderRadius) vars['--bt-radius'] = css.sectionBorderRadius
  if (css.titleColor) vars['--bt-title'] = css.titleColor
  if (css.subtitleColor) vars['--bt-subtitle'] = css.subtitleColor
  if (css.priceColor) vars['--bt-price'] = css.priceColor
  if (css.badgeBackground) vars['--bt-badge-bg'] = css.badgeBackground
  if (css.badgeTextColor) vars['--bt-badge-text'] = css.badgeTextColor
  if (css.buttonBackground) vars['--bt-btn-bg'] = css.buttonBackground
  if (css.buttonTextColor) vars['--bt-btn-text'] = css.buttonTextColor
  if (css.savingsColor) vars['--bt-savings'] = css.savingsColor

  return vars
}
