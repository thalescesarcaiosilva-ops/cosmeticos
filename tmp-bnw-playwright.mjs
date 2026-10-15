import { chromium } from 'playwright-core'

const url =
  'https://www.belezanaweb.com.br/produto/lancome-monsieur-big-volume-dramatico-mascara-para-cilios-10ml/'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ locale: 'pt-BR' })
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
const title = await page.title()
const text = await page.content()
const prices = [...text.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)].map((m) => m[1])
console.log({ title, denied: /Access Denied/i.test(text), prices: prices.slice(0, 15) })
await browser.close()
