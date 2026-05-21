# ShareMii — developer and agent architecture guide

## Mental model

1. **Router** (`src/router.ts`) is the single source of truth for which **page render function** runs for a given URL/hash.
2. Each **page** returns an optional **cleanup** function (unsubscribes, timers) — the router stores and invokes it before the next navigation.
3. **Public pages** typically use `wrapPublicPage(mainEl)` so header/footer/bottom bar persist and only inner content swaps.
4. **Services** encapsulate Supabase, HTTP APIs, and cross-cutting behavior (auth, theme, analytics).

---

## Routing mechanics

- **Hash default**: `getHash()` in `router.ts` reads `window.location.hash`; if missing, `#/` is set on init.
- **Path fallback**: If `pathname` is not `/`, it’s treated like a hash path (hosted SPA flexibility).
- **Custom event**: `window.dispatchEvent(new Event('sharemii:navigate'))` after `history.pushState` in `utils/routes.ts` so the router re-runs without a full reload.
- **Meta**: `resetPageMeta()` on each navigation; pages can set titles/descriptions via `utils/pageMeta.ts` where implemented.

When adding a route:

1. Add matcher in `navigate()` in `router.ts`.
2. Implement `renderFoo(app: HTMLElement)` in `src/pages/Foo.ts`.
3. Add nav links only where product requires (often `SiteHeader` constant `NAV_LINKS` or footer).

---

## Key directories

| Path | Responsibility |
| ---- | ---------------- |
| `src/pages/` | Top-level routes; imports its own `pages.css` or co-located `PageName.css` |
| `src/pages/admin/` | Staff UI; shared `adminShell.ts`, `admin.css` |
| `src/components/` | Reusable widgets (each feature folder: TS + CSS) |
| `src/services/` | Auth, DB, APIs, feature orchestration |
| `src/utils/` | Small pure helpers, DOM helpers, routing helpers |
| `src/layout/` | Shell wrappers, layout CSS |
| `src/styles/` | Global tokens and base styles |
| `supabase/` | `sync.sql`, numbered migrations |
| `scripts/` | `sync-db.mjs` (dev schema apply), generators |
| `tests/` | Vitest unit tests |
| `public/` | Static files served as-is |

---

## Important services (starting points)

| File | Notes |
| ---- | ----- |
| `services/supabase.ts` | Client singleton, queries, Mii fetch |
| `services/auth.ts` | Session lifecycle, `initAuth()` |
| `services/profile.ts` | Profiles, usernames |
| `services/profileGate.ts` | Blocks create flows until profile rules satisfied |
| `services/staffGate.ts` | Staff/admin checks for `/admin` |
| `services/miiApi.ts` | Render URL builder for Ariankordi API |
| `services/scanSubmit.ts` | QR scan modal and submit pipeline |
| `services/theme.ts` | Light/dark, `THEME_CHANGE_EVENT` |
| `services/analytics.ts` | Optional Plausible loader |
| `services/social.ts` | Following feed, social tables |

---

## Styling conventions

- **Tokens first**: `src/styles/variables.css` defines spacing, radii, colors for `:root` and `[data-theme='dark']`.
- **Globals**: `globals.css` for resets, scrollbar styling, shared utilities (`.page-title`, `.section-title`, empty states).
- **Components**: Co-located `Component.css`; shared controls in `components/shared.css` (e.g. `.pill-btn`, `.app-tab`).
- **BEM-like** class names appear throughout (`block__element--modifier`).

---

## TypeScript conventions

- `strict: true`, `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- Path alias `@/` → `src/`.
- Domain types centralized in `src/types.ts` (profiles, reports, Miis, enums).

---

## Database workflow

- Local/dev: `npm run dev` runs DB sync first. Requires Supabase CLI linking or `DATABASE_URL` — see root README.
- SQL changes: Prefer new migrations under `supabase/migrations/` and wire into `sync-db.mjs` if they must apply automatically.

---

## Testing

- `vitest.config.ts` at repo root; tests in `tests/`.
- Run `npm test` before substantial refactors.

---

## Debugging tips for agents

1. **Route not firing**: Confirm hash format matches regex in `router.ts`; check `sharemii:navigate` dispatch.
2. **Auth loops**: Inspect `getAuthSession()` timing and `profileGate` (`requireGamertag`).
3. **Missing styles**: Component CSS may need import in the TS file or a parent `main.ts` global for shared layers.
4. **Renders broken**: Verify Mii hex/data path in `miiApi.ts` and network to render host.

When in doubt, trace from **`router.ts` → page `render*` → services used by that page**.
