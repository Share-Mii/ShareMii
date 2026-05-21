# ShareMii — brand, voice, and experience

## Positioning

ShareMii is a **Mii sharing community**: a friendly place to **browse**, **yeah**, **save**, **download**, **remix**, and **submit** Miis. The product embraces **Nintendo-adjacent** nostalgia (Wii / Miiverse-era language) while remaining a **modern web app** (responsive layout, dark mode, accessibility-minded patterns).

Naming in the UI mixes:

- **Community terms**: “Residents”, “Browse Residents”, **Yeah** (like Miiverse) for positive reactions.
- **Product clarity**: “Mii Creator”, “Scan & Submit”, platform badges (**3DS**, **Wii U**, **Tomodachi Life**).

Agents editing copy should **keep** this dual vocabulary unless product direction changes.

---

## Visual identity

### Typography

- **Primary font**: **Nunito** (weights 400–800), loaded from Google Fonts in `index.html`.
- **Roles**: Page titles (`.page-title`), section titles (`.section-title`), overlines (`.text-overline`), body (`.globals.css` base).

### Color system

Tokens live in `src/styles/variables.css`:

- **Light theme**: Soft **pastel** background tints (lavender-tinted body `--color-bg-body`), **sky-blue hero** gradient (`--color-bg-hero` → `--color-bg-hero-end`), **electric blue accent** (`--color-accent` `#0088ff`).
- **Dark theme**: Activated via `document.documentElement.dataset.theme = 'dark'` (see `src/services/theme.ts`). Accent shifts to a **cyan** (`#0ab9f0`) for contrast on dark surfaces.
- **Semantic accents**: Discussion/purple (`--color-discuss`), coral highlights (`--color-coral`), gold for special emphasis (`--color-accent-gold`).
- **Surfaces**: Card/panel backgrounds, subtle borders, frosted overlays for modals.

Always read **light and dark** pairs when introducing new colors.

### Shape and depth

- **Pill buttons** (`.pill-btn`): rounded “channel UI” feel; filled primary uses accent; outline for secondary.
- **Tiles**: Large corner radius (`--radius-tile` ~18px), soft shadows (`--shadow-tile`, stronger on hover).
- **Hero**: Marketing-style headline with **accent span** on “Mii's”; **polaroid**-style cards and **floating** decorative elements evoke photo walls and Wii-era charm.

### Motion

- **Page enter**: Content inside `.page-shell__content` uses reveal utilities (`utils/reveal.ts`, `utils/motion.ts`) — transitions target **main** only, not the sticky header.
- **Micro-interactions**: Buttons scale slightly on press (`:active`), fast transitions (`--transition-fast`).

### Iconography

- **Font Awesome 6** (solid set) via `@fortawesome/fontawesome-free`; helpers in `utils/icon.ts` (`icon`, `iconSpan`).

---

## UX patterns agents should preserve

1. **Hash SPA**: Primary navigation uses `#/…` links in header and body; respect `router.ts` when adding routes.
2. **Auth gates**: Protected flows open **login modal** and redirect home if anonymous; **gamertag** completion is enforced for create/remix (`profileGate.ts`).
3. **Scan & submit**: Not a standalone page — triggered by `#/submit` normalization, `data-scan-submit`, or hero CTA when logged in.
4. **Theme**: Respect `sharemii-theme-change` and `data-theme` on `<html>`; avoid hard-coded colors outside tokens when possible.
5. **Empty states**: Use shared empty-state patterns (`utils/emptyState.ts`, `.page-empty-state` in `globals.css`).

---

## Voice and tone (for UI copy and marketing)

| Do | Avoid |
| -- | ----- |
| Warm, playful, short sentences | Corporate or overly technical jargon |
| “Yeah”, “Residents”, Mii-friendly verbs | Mocking Nintendo IP or claiming official affiliation |
| Clear labels for moderation/safety | Alarmist or shaming language |

Legal and safety routes (`Legal.ts`) should stay **precise and neutral**; hero and browse copy can be more **expressive**.

---

## Assets

- **Logo**: `src/utils/logo.ts`, `src/styles/logo.css`, `public/assets/` (e.g. `logo-solid.svg`, `favicon.svg`).
- **PWA manifest**: `public/manifest.webmanifest` — `theme_color` aligns with light accent blue.

---

## Competitive / legal sensitivity

ShareMii deals with **user-generated Mii data** and **Nintendo-adjacent** presentation. Agents should not imply **official Nintendo endorsement**. Prefer “community”, “share”, “create”, and factual feature descriptions in outward-facing text unless maintainers specify otherwise.
