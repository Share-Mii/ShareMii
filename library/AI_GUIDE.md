# Guide for AI agents working on ShareMii.net

You are maintaining a **community Mii platform**, not a generic social app. Read this before editing code, copy, or design.

---

## Required reading order

1. [PRODUCT.md](./PRODUCT.md) — mission and boundaries
2. [BRAND.md](./BRAND.md) — colors, spacing, motion, UI patterns
3. [COPY.md](./COPY.md) — voice, Yeah/plaza terms, changelogs
4. [SEO.md](./SEO.md) — if touching routes, meta, sitemap, `llms.txt`

---

## Non-negotiables

| Rule | Why |
| ---- | --- |
| Public brand is **ShareMii.net** | Disambiguation from save editor and SEO |
| User-facing appreciation is **Yeah**, not Like | Miiverse heritage; wired through UI and DB naming |
| **Not affiliated with Nintendo** | Legal and trust — keep in safety copy |
| **Not the .ltd save editor** | Link `https://sharemii.qwkuns.me/` when "ShareMii" is ambiguous |
| Use **CSS variables** from `variables.css` | Light/dark theme parity |
| Keep `src/config/brand.ts` and `worker/data/brand.ts` in sync | Client + edge SEO |

---

## Architecture snapshot

- **Frontend:** Vite + TypeScript, vanilla components (no React)
- **Backend:** Supabase (auth, Postgres, realtime)
- **Edge:** Cloudflare Pages `functions/_middleware.ts` + `worker/` for bot HTML/meta
- **Mii renders:** External API via `src/services/miiApi.ts`
- **QR:** `jsQR` + `miijs` in submit flow

Do not introduce a framework without an explicit user request.

---

## Where to change things

| Task | Location |
| ---- | -------- |
| Page copy (Help, About) | `src/pages/Help.ts`, `src/pages/About.ts` |
| Home hero | `src/pages/Home.ts` |
| SEO FAQ / safety | `seo/content.ts` |
| Crawler meta / JSON-LD | `worker/data/meta.ts` |
| Design tokens | `src/styles/variables.css` |
| Brand constants | `src/config/brand.ts`, `worker/data/brand.ts` |
| Discord changelog | `scripts/discordChangelogEmbeds.ts`, release tool |
| LLM crawler summary | `public/llms.txt` |

---

## Design decisions (defaults)

When the user asks for "Nintendo feel" or "more playful":

- Rounder corners (pill buttons, 18px tiles) — already default
- Sky blue hero, pastel floaters — already default
- Shorter headlines, plaza vocabulary — see COPY.md
- Subtle motion on hero — don't add aggressive animations
- **Do not** add Nintendo logos, Miiverse trademarked strings, or exact Wii channel clones

When adding UI:

- Horizontal padding: `var(--page-gutter)`
- Section gaps: `var(--spacing-lg)` – `var(--spacing-xl)`
- Max content width: `var(--layout-max-width)`; prose: `var(--layout-reading-width)`
- Mobile: respect `--bottom-bar-height` and safe areas

---

## Copy decisions (defaults)

- CTAs: verb-first, one primary blue button per cluster
- Sort label **Most Yeah'd** stays unless product explicitly renames the feature
- Changelogs: benefit-first bullets; see COPY.md template
- Run `normalizeReleaseTypography` on release text destined for Discord

---

## Common mistakes to avoid

1. **Renaming Yeah to Like** in UI — breaks community voice and existing docs
2. **Using "ShareMii" alone** in titles — use ShareMii.net
3. **Hardcoded colors** — breaks dark mode
4. **Indexing private routes** — `/feed`, `/settings`, etc. are `noindex` (SEO.md)
5. **Implying Switch QR submit** in marketing if product only supports 3DS/Wii U/Tomodachi for scan
6. **Committing secrets** — `.env`, keys, IndexNow key file is public by design; API secrets are not
7. **Drifting library docs** — update BRAND/COPY/PRODUCT when you change tokens or terminology

---

## Testing expectations

- `npm test` for unit tests
- `npm run dev` runs DB sync — needs Supabase link
- Visual check: light + dark theme, mobile bottom bar clearance
- SEO: if new public route, update sitemap generator, meta resolver, and SEO.md table

---

## When to update this library

Update docs in the same PR when you:

- Add or rename user-facing terminology
- Change design tokens or layout constants
- Shift product positioning or supported platforms
- Add a new public route or changelog format

---

## Human tone reminder

The maintainer wants ShareMii.net to become the **one-stop Mii community hub**. Every feature and string should reinforce: browse, create, share, collect, and belong — with Nintendo-adjacent warmth and honest console scope.
