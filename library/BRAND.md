# ShareMii.net — brand & design system

Design direction: **Nintendo-adjacent warmth** — the feel of a first-party system menu or plaza (rounded tiles, soft sky blues, friendly type, gentle motion) without copying Nintendo logos, exact UI chrome, or trademarked trade dress.

When in doubt: *Would this feel at home on a Wii U menu or a Tomodachi Life bulletin board?*

---

## Brand identity

| Item | Value |
| ---- | ----- |
| Public name | **ShareMii.net** |
| Short name in sentences | ShareMii.net (include `.net` in titles, header, footer, schema) |
| Tagline (hero) | Browse, share, & collect **Miis.** |
| Default description | Community Mii QR code gallery and online Mii Maker for 3DS, Wii U, and Tomodachi Life |
| Personality | Friendly, clear, slightly playful, community-forward |
| Avoid | Corporate SaaS tone, edgy meme voice, impersonating Nintendo |

### Logo & marks

- Use existing site favicon and wordmark in header — do not invent new logo shapes in copy/docs
- Do not use Nintendo logos, Mii Channel exact assets, or red Wii U pill buttons in marketing
- Accent blue is *inspired by* Nintendo system UI, not a trademark claim

---

## Color system

**Source of truth:** [`src/styles/variables.css`](../src/styles/variables.css)

### Core palette (light theme)

| Token | Hex | Role |
| ----- | --- | ---- |
| `--color-accent` | `#0088ff` | Primary actions, links, focus — Nintendo-style system blue |
| `--color-accent-hover` | `#0070d6` | Hover / pressed primary |
| `--color-text` | `#1a1a2e` | Body text |
| `--color-text-muted` | `#6b7280` | Secondary labels, meta |
| `--color-bg-body` | lavender-tinted mix | Page backdrop |
| `--color-bg-panel` | `#ffffff` | Cards, panels, inputs |
| `--color-bg-hero` → `--color-bg-hero-end` | `#e6f4fe` → `#c8e8ff` | Home hero sky gradient |
| `--color-coral` | `#e85c4d` | Warm accent (use sparingly) |
| `--color-discuss` | `#6b4ce6` | Discussion / secondary accent |
| `--color-accent-gold` | `#c9a227` | Highlights, badges (sparingly) |
| `--color-border` | `#e5e7eb` | Default borders |

### Pastel accents (decorative)

Used in hero floaters, soft backgrounds, and delight — not for primary text:

`--pastel-pink`, `--pastel-lavender`, `--pastel-yellow`, `--pastel-mint`, `--pastel-sky`, `--pastel-peach`

### Dark theme

Same token names; accent shifts to `#0ab9f0`. Panels use `#2c2c30` on `#121214` body. Always test both themes when adding new surfaces.

### Color usage rules

1. **One primary blue** per view — don't rainbow competing CTAs
2. **White / panel surfaces** for cards; let hero gradients carry atmosphere
3. **Borders over heavy shadows** — elevation is subtle (`--shadow-1` … `--shadow-4`)
4. **Clothing / Mii Maker** orange (`--color-clothing-label`) stays inside the editor context
5. Discord embeds: prefer accent blue as embed color when a hex is needed (`0x0088ff` → `8721663` decimal)

---

## Typography

| Token | Value | Use |
| ----- | ----- | --- |
| `--font-family` | `'Nunito', system-ui, sans-serif` | All UI — rounded, approachable (not corporate grotesk) |
| `--font-size-hero` | `clamp(2.25rem, 3.5vw + 1rem, 3.5rem)` | Home hero |
| `--font-size-2xl` | `2rem` | Page titles |
| `--font-size-xl` | `1.25rem` | Section titles |
| `--font-size-body` | `1rem` | Body |
| `--font-size-sm` | `0.875rem` | Meta, badges, buttons |
| `--font-size-caption` | `0.75rem` | Fine print |
| `--line-height-tight` | `1.15` | Headlines |
| `--line-height-body` | `1.55` | Paragraphs |
| `--letter-spacing-tight` | `-0.02em` | Large display type |
| `--letter-spacing-overline` | `0.06em` | Small caps / labels |

### Type hierarchy

- **Page title:** 800 weight, tight line-height
- **Section title:** 700 weight
- **Body:** 400–600; buttons 600–700
- **Muted intro paragraphs:** `color: var(--color-text-muted)`, ~1.6 line-height

Headlines are short and punchy (2–6 words per line). Subheads explain the *action*, not the technology stack.

---

## Spacing & layout

| Token | Value | Use |
| ----- | ----- | --- |
| `--spacing-xs` | `0.25rem` (4px) | Tight gaps |
| `--spacing-sm` | `0.5rem` (8px) | Icon gaps, list spacing |
| `--spacing-md` | `1rem` (16px) | Default padding unit |
| `--spacing-lg` | `1.5rem` (24px) | Section inner padding |
| `--spacing-xl` | `2rem` (32px) | Section gaps |
| `--spacing-2xl` | `3rem` (48px) | Large section breaks |
| `--spacing-3xl` | `4rem` (64px) | Page bottom padding |
| `--page-gutter` | `clamp(1.25rem, 4vw, 3rem)` | Horizontal page margin |
| `--mobile-gutter` | safe-area aware | Phone horizontal inset |
| `--layout-max-width` | `1440px` | Main content cap |
| `--layout-reading-width` | `48rem` | Legal, Help, About |
| `--page-content-top` | `var(--spacing-xl)` | Default top offset below header |

### Layout rules

1. Content is **centered** in `--layout-max-width` with responsive gutters — never edge-to-edge text on desktop
2. **Reading pages** (Help, About, Legal) use `--layout-reading-width` — comfortable single column
3. **Grids** (Mii tiles) use `minmax` with `--mii-card-min-width` / `--mii-card-max-width`
4. **Touch targets** minimum `--touch-target-min` (44px) on mobile
5. **Safe areas** — header and bottom bar account for `env(safe-area-inset-*)`

### Chrome dimensions

| Element | Height |
| ------- | ------ |
| Desktop header | 72px (`--header-height`) |
| Mobile header | 64px + safe top |
| Bottom bar (mobile) | 64px + safe bottom |

---

## Radius & shape

| Token | Value | Use |
| ----- | ----- | --- |
| `--radius-pill` | `999px` | Buttons, badges, chips |
| `--radius-tile` | `18px` | Mii cards, large tiles — soft Nintendo tile feel |
| `--radius-lg` | `12px` | Modals inner panels, previews |
| `--radius-md` | `10px` | Inputs, smaller cards |
| `--radius-sm` | `6px` | Tight corners |

Prefer **fully rounded pills** for actions; **18px tiles** for content cards. Avoid sharp 4px corporate corners.

---

## Elevation & borders

- Default card: `1px solid var(--color-border)` + `--shadow-tile` (very light)
- Hover: `--shadow-tile-hover`, optional accent border
- Modals: `--shadow-modal` on panel; `--color-modal-overlay` scrim
- Frosted header: `--color-bg-frosted` + `backdrop-filter: blur(12px)`

**Do not** stack heavy drop shadows — Wii-era UI was flat-friendly with crisp edges.

---

## Motion

| Token | Value |
| ----- | ----- |
| `--transition-fast` | `150ms ease` |
| `--transition-normal` | `250ms ease` |
| `--ease-out-smooth` | `cubic-bezier(0.22, 1, 0.36, 1)` |

- Home hero: staggered `home-rise` / `home-fade-in` on load
- Buttons: slight `scale(0.97)` on active
- Hero floaters: slow drift — playful, not distracting
- Respect `prefers-reduced-motion` patterns already in the codebase

Motion should feel **bouncy and welcoming**, never flashy or parallax-heavy.

---

## Core components (visual language)

### Buttons (`.pill-btn`)

- Pill-shaped, 600–700 weight
- **Filled** (`pill-btn--filled`): accent background, white text — primary CTA
- **Outline**: panel background, border — secondary
- **Active** state: filled accent for toggles

Primary CTA examples: "Browse Residents", "Scan & Submit", "Open Mii Creator"

### Mii tiles

- Aspect `--mii-card-aspect` (4/3)
- Rounded `--radius-tile`
- Stats row with Yeah count — heart/yeah icon, not generic "likes"

### Hero

- Sky gradient background
- Floating pastel shapes + polaroid stack
- "Works with" platform badges (3DS, Wii U, Tomodachi Life)

### Empty states

- Friendly one-liner + link back to plaza
- No guilt-tripping copy

---

## Iconography

- Use project icon helper (`icon`, `iconSpan`) — consistent stroke icons
- Yeah action uses custom yeah icon, not a generic heart (Miiverse nod)
- Platform badges are text pills, not console logos

---

## Theming

- `data-theme="light"` | `data-theme="dark"` on `<html>`
- Persisted in `localStorage` (`sharemii-theme`)
- New components must use CSS variables — no hardcoded `#fff` / `#000` for surfaces

---

## Nintendo feel — do's and don'ts

### Do

- Use plaza / residents / Yeah vocabulary
- Short, optimistic microcopy ("Browse Residents", "Back to plaza")
- Soft blues, pastels, rounded rectangles
- Clear step lists on Help (numbered, plain language)
- Celebrate community creations in spotlight / trending

### Don't

- Say "we are Nintendo" or "official Mii service"
- Use Wii U exact channel art or copyrighted character pitches in brand assets
- Dark patterns, infinite scroll guilt, or engagement bait
- Swap Yeah for Like in user-facing UI
- Overuse exclamation marks!!!

---

## File references for implementers

| Concern | Location |
| ------- | -------- |
| Design tokens | `src/styles/variables.css` |
| Global type | `src/styles/globals.css` |
| Shared buttons | `src/components/shared.css` |
| Page layout | `src/pages/pages.css` |
| Brand constants | `src/config/brand.ts`, `worker/data/brand.ts` |
| Release tool styling | `tools/release/page.html` |

When adding tokens, update this document's tables in the same change.
