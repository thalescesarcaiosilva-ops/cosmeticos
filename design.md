# Design System — Loja de Cosméticos

> **Referência visual:** [dotcosmeticos.com.br](https://www.dotcosmeticos.com.br/)  
> **Escopo:** layout, estrutura, cores, tipografia e componentes — **não** conteúdo (produtos, categorias, textos legais, políticas).

Este documento descreve como replicar o **visual e a arquitetura de UI** da loja de referência para o seu próprio ecommerce. Todo conteúdo (nomes de categorias, produtos, selos, links institucionais) deve vir do **seu** banco de dados e CMS — use placeholders até cadastrar.

---

## 1. Princípios

| Princípio | Aplicação |
|-----------|-----------|
| Mobile-first | Layout pensado para 375px, expandindo em `sm` / `md` / `lg` / `xl` |
| Densidade comercial | Muitos produtos visíveis acima da dobra; grids compactos |
| Confiança | Faixa de selos/benefícios sempre visível no topo |
| Clareza de preço | Preço promocional em destaque; preço original riscado; parcelamento abaixo |
| Carrosséis horizontais | Seções de produtos com scroll lateral em mobile |

---

## 2. Paleta de cores

Extrair os valores exatos com DevTools no site de referência e registrar abaixo. Tokens iniciais baseados no padrão visual observado (tema claro, acentos quentes, badges de desconto):

```css
/* src/app/globals.css — @theme */
:root {
  /* Fundos */
  --color-surface: #ffffff;
  --color-surface-muted: #f7f7f7;
  --color-surface-dark: #1a1a1a;

  /* Texto */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-inverse: #ffffff;
  --color-text-muted: #999999;

  /* Marca (valores extraídos da referência visual Dot) */
  --color-brand-primary: #d41467;      /* magenta — busca, conta, carrinho, WhatsApp */
  --color-brand-primary-hover: #b81058;
  --color-logo: #3d1654;               /* roxo escuro — logo, telefone, ajuda */
  --color-logo-light: #5c3d6e;         /* sufixo do logo (ex.: "cosméticos") */

  /* Comercial */
  --color-price-sale: #1a1a1a;         /* preço "Por" */
  --color-price-original: #999999;     /* preço "De" riscado */
  --color-badge-discount: #e53935;     /* badge % OFF — fundo vermelho */
  --color-badge-discount-text: #ffffff;

  /* UI */
  --color-border: #e5e5e5;
  --color-border-strong: #cccccc;
  --color-success: #2e7d32;
  --color-warning: #f9a825;

  /* Top bar / trust strip */
  --color-topbar-bg: #ffffff;
  --color-topbar-text: #666666;
  --color-trust-strip-bg: #ffffff;
  --color-trust-strip-border: #eeeeee;

  /* Footer */
  --color-footer-bg: #1a1a1a;
  --color-footer-text: #cccccc;
  --color-footer-heading: #ffffff;
  --color-footer-link-hover: #ffffff;

  /* Menu de categorias */
  --color-nav-bg: #4B0D6E;
  --color-nav-text: #ffffff;
}
```

### Uso das cores

| Elemento | Token |
|----------|-------|
| Fundo geral da página | `--color-surface` |
| Faixa superior (links institucionais) | `--color-topbar-bg` |
| Faixa de selos/benefícios | `--color-trust-strip-bg` + borda inferior |
| Logo e links do menu principal | `--color-brand-primary` |
| Botão primário (comprar, cadastrar newsletter) | `--color-brand-primary` |
| Badge de desconto no card | `--color-badge-discount` |
| Preço promocional | `--color-price-sale`, `font-weight: 700` |
| Preço original | `--color-price-original`, `text-decoration: line-through` |
| Rodapé | `--color-footer-bg` |

---

## 3. Tipografia

A loja de referência usa fonte sans-serif limpa (similar a **Inter**, **Helvetica Neue** ou **system-ui**). Não copiar fontes proprietárias — usar equivalente gratuito.

```css
--font-sans: var(--font-inter), system-ui, -apple-system, sans-serif;
```

| Elemento | Tamanho (mobile → desktop) | Peso | Observação |
|----------|---------------------------|------|------------|
| Título de seção (H2) | 20px → 28px | 700 | Centralizado ou alinhado à esquerda |
| Nome do produto (card) | 13px → 14px | 400 | Máx. 2 linhas com `line-clamp-2` |
| Preço "Por" | 16px → 18px | 700 | Cor `--color-price-sale` |
| Preço "De" | 12px → 13px | 400 | Riscado |
| Parcelamento | 11px → 12px | 400 | Cinza secundário |
| Badge desconto | 11px → 12px | 700 | Fundo vermelho, texto branco |
| Top bar links | 11px → 12px | 400 | |
| Menu navegação | 13px → 14px | 500–600 | Uppercase opcional em itens principais |
| Footer títulos de coluna | 14px | 600 | Branco |
| Footer links | 13px | 400 | Cinza claro |

---

## 4. Espaçamento e grid

```
Container máximo: max-w-[1280px] ou max-w-7xl, mx-auto, px-4 md:px-6
Gap entre cards (grid): gap-3 md:gap-4
Padding vertical de seção: py-8 md:py-12
Border radius cards: rounded-lg (8px)
Border radius badges: rounded-full ou rounded-sm
Sombra cards: shadow-sm hover:shadow-md (transição suave)
```

### Breakpoints (Tailwind padrão)

| Breakpoint | Uso |
|------------|-----|
| default | 2 colunas de produtos, menu hamburger |
| `sm` (640px) | 2–3 colunas categorias |
| `md` (768px) | menu horizontal, 3 colunas produtos |
| `lg` (1024px) | 4 colunas produtos, mega menu |
| `xl` (1280px) | layout completo desktop |

---

## 5. Arquitetura de layout global

Todas as páginas públicas compartilham o mesmo shell:

```
┌─────────────────────────────────────────────────────────────┐
│  TOP BAR — links institucionais + redes sociais + contato   │
├─────────────────────────────────────────────────────────────┤
│  HEADER — logo | busca | conta | carrinho                   │
│  NAV — menu de categorias (horizontal ou mega menu)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      { CONTEÚDO }                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  NEWSLETTER (opcional na home; pode repetir no footer)     │
├─────────────────────────────────────────────────────────────┤
│  FOOTER — colunas + pagamentos + copyright                  │
└─────────────────────────────────────────────────────────────┘
```

### Componentes de layout (`src/components/layout/`)

| Componente | Responsabilidade |
|------------|------------------|
| `TopBar` | Links institucionais à esquerda; WhatsApp/redes à direita |
| `TrustStrip` | Faixa horizontal com 4–5 selos (ícone + título + subtítulo) |
| `Header` | Logo, campo de busca, ícones conta e carrinho com contador |
| `MainNav` | Lista de categorias; em mobile vira drawer |
| `Newsletter` | Título, subtítulo, input email, botão CTA |
| `Footer` | Grid de colunas, formas de pagamento, selos de segurança |
| `SiteLayout` | Wrapper que compõe todos acima + `{children}` |

---

## 6. Top Bar

**Estrutura (referência visual):**

```
[ Conheça mais sobre a {MARCA}: ] [Link] [Link] [Link]     [WhatsApp (DD) NNNNN-NNNN] [●FB] [●IG]
```

**Regras de implementação:**
- Fundo **branco** (`--color-topbar-bg: #ffffff`), borda inferior sutil
- Texto dos links em cinza (`--color-topbar-text`), 11–12px
- WhatsApp à direita: ícone + texto em **magenta** (`--color-brand-primary`)
- Facebook e Instagram: botões **circulares magenta** com ícone branco (28px)
- Container máximo ~1200px centralizado
- Em mobile: ocultar prefixo "Conheça mais sobre…"; links institucionais com scroll horizontal

---

## 7. Trust Strip (faixa de benefícios)

**Estrutura (referência visual):**

Faixa com 5 itens em linha no desktop; carrossel ou scroll horizontal no mobile:

```
[Ícone] DESDE {ANO}        [Ícone] FRETE GRÁTIS?     [Ícone] ENTREGA GARANTIDA
       {X} anos                    Veja as Regras           ou seu dinheiro de volta

[Ícone] PRODUTOS ORIGINAIS  [Ícone] LOJA 100% SEGURA
        Qualidade garantida          Seus dados protegidos
```

**Cada item:**
- Ícone SVG ou imagem 24–32px
- Título em caps ou semi-bold (12–13px)
- Subtítulo em cinza (10–11px), opcional
- Borda inferior sutil separando do header

**Dados:** array configurável no CMS ou constante editável — **não** hardcodar textos da loja de referência.

```typescript
type TrustBadge = {
  icon: string
  title: string
  subtitle?: string
  href?: string
}
```

---

## 8. Header

**Desktop:**

```
┌──────────┬────────────────────────────────────┬─────────────┐
│   LOGO   │  [ 🔍  Buscar produtos...        ] │  👤  🛒 (2) │
└──────────┴────────────────────────────────────┴─────────────┘
│  CAT 1  │  CAT 2  │  CAT 3  │  ...  │  CAT N              │
└───────────────────────────────────────────────────────────────┘
```

**Mobile:**
- Logo centralizado ou à esquerda
- Hamburger à esquerda
- Carrinho à direita com badge numérico
- Busca em ícone que expande overlay ou página `/busca`

**Especificações:**
- Header sticky (`sticky top-0 z-50`) com fundo branco e sombra ao scroll
- Campo de busca: `rounded-full`, borda `--color-border`, placeholder cinza
- Carrinho: badge circular vermelho/magenta com quantidade
- Altura total header + nav: ~120–140px desktop

---

## 9. Página Home (`src/app/page.tsx`)

Seções na ordem vertical (como a referência):

### 9.1 Hero / Banner principal (opcional)
- Imagem full-width ou carrossel de banners
- Proporção ~16:5 desktop, ~4:5 ou 1:1 mobile
- CTA sobre imagem (botão com fundo sólido)
- Dados: tabela `banners` no Supabase ou CMS

### 9.2 Grid de categorias — "Compre por categoria!"
- Título H2 centralizado
- Grid 3×3 ou 4 colunas de **cards de categoria**
- Cada card: imagem quadrada + nome da categoria abaixo
- Hover: leve zoom na imagem (`scale-105`)
- Link: `/colecoes/{slug}`

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  img   │ │  img   │ │  img   │ │  img   │
│ Nome   │ │ Nome   │ │ Nome   │ │ Nome   │
└────────┘ └────────┘ └────────┘ └────────┘
```

### 9.3 Grid de necessidades — "Encontre o que você precisa"
- Segundo grid de cards, estilo similar ao anterior
- Pode ser **coleções curadas** ou **tags** (ex.: "Para hidratar", "Para finalizar")
- Mesmo padrão visual: imagem + label
- Dados: suas coleções — não usar nomes da Dot

### 9.4 Carrosséis de produtos (repetir N vezes)

Cada seção segue o mesmo padrão:

```
────────────── Acabaram de chegar! ──────────────
◀  [Card] [Card] [Card] [Card] [Card] [Card]  ▶
```

**Títulos de seção (exemplos genéricos — definir os seus):**
- Lançamentos
- Mais vendidos
- Recomendados para você

**Comportamento:**
- Scroll horizontal com snap em mobile
- Setas prev/next no desktop
- Ver todos → link para coleção filtrada

### 9.5 Newsletter — "Clube de Ofertas"
- Fundo contrastante (cinza claro ou cor da marca suave)
- Título + descrição curta
- Input email + botão "Cadastrar"
- Estados: idle, loading, sucesso, erro
- Validação Zod no client e na API

---

## 10. Página de Coleção (`src/app/colecoes/[slug]/page.tsx`)

**Layout (referência visual — típico Shopify):**

```
┌─────────────────────────────────────────────────────────────┐
│  Breadcrumb: Home > {Nome da Coleção}                        │
├─────────────────────────────────────────────────────────────┤
│  {Nome da Coleção}                    [Ordenar por ▼]       │
│  {Descrição opcional da coleção}                            │
├──────────────┬──────────────────────────────────────────────┤
│  FILTROS     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │
│  (sidebar)   │  │    │ │    │ │    │ │    │                 │
│              │  └────┘ └────┘ └────┘ └────┘                 │
│  - Preço     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │
│  - Marca     │  │    │ │    │ │    │ │    │                 │
│  - Disponib. │  └────┘ └────┘ └────┘ └────┘                 │
│              │                                               │
│              │  [ Carregar mais ] ou paginação               │
└──────────────┴──────────────────────────────────────────────┘
```

**Mobile:** filtros em drawer/modal acionado por botão "Filtrar"

**Toolbar superior da grade:**
- Contagem: "X produtos"
- Select ordenação: Relevância | Menor preço | Maior preço | Mais vendidos | Lançamentos

**Grid de produtos:** 2 colunas mobile, 3 tablet, 4 desktop

---

## 11. Card de Produto (`ProductCard`)

Componente reutilizado em home, coleções e busca.

```
┌─────────────────────────┐
│  [-35%]           (opc) │  ← badge desconto, canto sup. esquerdo
│                         │
│      IMAGEM 1:1         │
│                         │
├─────────────────────────┤
│  ★★★★☆ (11)            │  ← avaliação opcional
│  Nome do produto em     │
│  até duas linhas...     │
│                         │
│  De R$ 169,90           │  ← riscado, cinza (se houver desconto)
│  Por R$ 108,90          │  ← bold, destaque
│  5x de R$ 21,78 s/ juros│  ← parcelamento
└─────────────────────────┘
```

**Especificações:**
- Aspect ratio imagem: `1 / 1` (`aspect-square`)
- Badge desconto: só se `original_price > price`; calcular `%` no servidor
- Hover: sombra + opcional segundo slide de imagem
- Link: `/produtos/{slug}`
- Botão rápido "Adicionar" no hover (desktop) — opcional fase 2

```typescript
type ProductCardProps = {
  id: string
  slug: string
  name: string
  imageUrl: string
  price: number
  originalPrice?: number | null
  ratingCount?: number
  ratingAverage?: number
  installments?: { count: number; value: number }
}
```

---

## 12. Rodapé (`Footer`)

**Estrutura em colunas (desktop 4–5 colunas):**

```
┌──────────────┬──────────────┬──────────────┐
│  Institucional│  Serviços    │  Atendimento │
│  - links CMS │  - links CMS │  - telefone  │
│              │              │  - WhatsApp  │
└──────────────┴──────────────┴──────────────┘
┌──────────────┬──────────────┬──────────────┐
│  Segurança   │  Formas de   │  Redes       │
│  [selos]     │  pagamento   │  Sociais     │
│              │  [ícones 4×N]│  [ícones ●]  │
└──────────────┴──────────────┴──────────────┘
┌─────────────────────────────────────────────────────────────┐
│  © {ano} {Sua Loja} — CNPJ: {seu CNPJ}                      │
└─────────────────────────────────────────────────────────────┘
```

**Faixa central (confiança):** três colunas — selos de segurança, grid de bandeiras de pagamento (até 4 por linha), ícones sociais em círculos. Sem seção de download de app.

**Estilo:**
- Fundo escuro (`--color-footer-bg`)
- Texto cinza claro
- Links com hover branco
- Ícones de pagamento em escala de cinza ou coloridos pequenos (24–32px)
- Padding generoso: `py-12 md:py-16`

**Conteúdo:** 100% seus links e textos legais.

---

## 13. Páginas adicionais (fase posterior)

Mesmo layout shell; conteúdo dinâmico:

| Rota | Descrição |
|------|-----------|
| `/produtos/[slug]` | PDP — galeria, preço, variantes, descrição, comprar |
| `/busca` | Resultados de busca com mesmo `ProductCard` |
| `/carrinho` | Lista de itens, subtotal, CTA checkout |
| `/checkout` | Endereço, frete, pagamento |
| `/conta` | Login, cadastro, pedidos |
| `/paginas/[slug]` | CMS para institucionais (quem somos, trocas, etc.) |

---

## 14. Ícones e imagens

- Ícones: **Lucide React** ou **Heroicons** (outline, 20–24px)
- Imagens de produto: WebP/AVIF via `next/image`
- Placeholders: `blur` ou cor `#f0f0f0` enquanto carrega
- Categorias: imagens 400×400 mínimo

---

## 15. Animações e interações

| Interação | Comportamento |
|-----------|---------------|
| Hover card produto | `shadow-md`, transição 200ms |
| Hover link menu | cor `--color-brand-primary` |
| Botão primário | hover escurece 10%; active scale 0.98 |
| Carrossel | scroll-snap; momentum no touch |
| Drawer mobile menu | slide da esquerda, overlay escuro 50% |
| Toast newsletter | slide up, auto-dismiss 4s |

Evitar animações pesadas — priorizar performance.

---

## 16. Acessibilidade

- Contraste mínimo WCAG AA (4.5:1 texto normal)
- `alt` em todas as imagens de produto e categoria
- `aria-label` em ícones sem texto (carrinho, busca, redes)
- Foco visível em links e botões (`focus-visible:ring-2`)
- Carrosséis navegáveis por teclado
- Formulários com `<label>` associado

---

## 17. Mapeamento Tailwind (`globals.css`)

```css
@theme inline {
  --color-surface: var(--color-surface);
  --color-brand: var(--color-brand-primary);
  --color-brand-hover: var(--color-brand-primary-hover);
  --color-footer: var(--color-footer-bg);
  --font-sans: var(--font-inter), system-ui, sans-serif;
}
```

Classes utilitárias sugeridas:
- `.btn-primary` — fundo brand, texto branco, rounded-full, px-6 py-2.5
- `.section-title` — text-xl md:text-2xl font-bold text-center mb-6
- `.product-grid` — grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4

---

## 18. Checklist de implementação

### Fase 1 — Layout shell
- [ ] `TopBar`, `TrustStrip`, `Header`, `MainNav`, `Footer`, `SiteLayout`
- [ ] Tokens de cor e tipografia em `globals.css`
- [ ] Menu mobile (drawer)

### Fase 2 — Home
- [ ] Grid de categorias (dados Supabase)
- [ ] Grid de coleções curadas
- [ ] `ProductCard` + carrossel de produtos
- [ ] `Newsletter` com API + Zod

### Fase 3 — Coleção
- [ ] Página `/colecoes/[slug]`
- [ ] Filtros e ordenação
- [ ] Paginação ou infinite scroll

### Fase 4 — Produto e checkout
- [ ] PDP `/produtos/[slug]`
- [ ] Carrinho e checkout

---

## 19. O que NÃO copiar da referência

- Nomes de produtos, marcas e categorias
- Textos de políticas (troca, privacidade, frete)
- Imagens e logos
- Depoimentos e avaliações reais
- Números de telefone, CNPJ, endereço
- Conteúdo SEO específico da Dot

Use a referência **apenas** para decisões de layout, hierarquia visual, espaçamento e padrões de componentes.
