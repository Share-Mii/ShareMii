# ShareMii — website structure and systems

## Product summary

**ShareMii** is a client-side single-page application for browsing, sharing, creating, and moderating **Nintendo Mii** characters. The community submits Miis by scanning QR codes (3DS, Wii U, Switch, Tomodachi Life) or builds them in an in-browser **Mii Maker**. Content and accounts are backed by **Supabase** (Postgres, Auth, Realtime). Mii preview images are produced via an external render API (`mii-unsecure.ariankordi.net`) wrapped in `src/services/miiApi.ts`.

---

## High-level architecture

| Layer | Role |
| ----- | ---- |
| **Entry** | `index.html` mounts `#app`; `src/main.ts` loads global CSS, initializes theme, auth, analytics, then the router |
| **Routing** | Hash-based SPA (`#/…`) with `navigateTo()` / `sharemii:navigate` for history-style navigation (`src/router.ts`, `src/utils/routes.ts`) |
| **Pages** | Vanilla TS modules under `src/pages/` that build DOM and return optional cleanup functions |
| **Layout** | `wrapPublicPage()` (`src/layout/pageShell.ts`) wraps main content with persistent **site header**, **footer**, and **bottom bar** |
| **Data** | `src/services/supabase.ts`, `auth.ts`, `profile.ts`, `social.ts`, `miiApi.ts`, `admin.ts`, etc. |
| **Styling** | Design tokens in `src/styles/variables.css`; global typography and patterns in `globals.css`; per-component CSS colocated with components |

There is **no React/Vue/Svelte** — UI is imperative DOM construction with scoped CSS files.

---

## Page and route map

Routes are resolved in `src/router.ts`. Unless noted, paths work as **hash routes** (primary) and some flows use `history.pushState` via `navigateTo()`.

### Public

| Route | Page module | Purpose |
| ----- | ----------- | ------- |
| `#/` | `Home.ts` | Landing: hero (“Browse, share, & collect Mii's”), platform badges, polaroid-style visuals, **Most Loved** spotlight, filterable/sortable grid, optional **following feed** when logged in |
| `#/browse` | `Browse.ts` | Search and filters (platform, gender, tags), sort options |
| `#/mii/:id` | `Detail.ts` | Mii detail: renders, stats, **yeah**/favorite/save/share/embed, comments, related Miis, remix entry |
| `#/u/:username` | `Profile.ts` | Public profile (gamertag-based URL) |
| `#/legal`, `#/privacy`, `#/terms`, `#/child-safety`, `#/delete-account` | `Legal.ts` | Policy and legal copy (`isLegalPageId`) |

### Authenticated (login modal if signed out)

| Route | Page module | Purpose |
| ----- | ----------- | ------- |
| `#/create` | `Create.ts` | Mii Creator (and entry for remix/edit when navigated from router with data) |
| `#/create/remix/:id` | `Create.ts` | Remix flow: loads source Mii, requires login + gamertag |
| `#/edit/:id` | `Create.ts` | Edit own Mii; non-owners redirect to `#/mii/:id` |
| `#/favorites` | `Favorites.ts` | Saved Miis |
| `#/uploads` | `Uploads.ts` | User’s submissions |
| `#/collections` | `Collections.ts` | User’s collections |
| `#/collection/:id` | `CollectionDetail.ts` | Single collection |
| `#/settings` | `Settings.ts` | Account/profile/settings |
| `#/profile` | (redirect) | Redirects to `#/u/{username}` if profile complete, else `#/settings` |

### Staff / admin (gated)

| Route | Page module | Gate |
| ----- | ----------- | ---- |
| `#/admin` | `admin/Dashboard.ts` | `requireStaffProfile()` |
| `#/admin/reports`, `#/admin/reports/:id` | `Reports.ts`, `ReportDetail.ts` | Staff |
| `#/admin/users` | `Users.ts` | Staff |
| `#/admin/audit` | `Audit.ts` | Staff |
| `#/admin/settings` | `AdminSettings.ts` | `requireAdminProfile()` |

### Special behaviors

- **`#/submit`** (legacy): Normalized away; opens the **scan-and-submit** flow (`scanSubmit.ts`) instead of a full page.
- **`#residents`**: Normalized to `#/` so fragment-only links don’t break SPA routing.
- **Page transitions**: `runPageEnter` / `reveal` utilities animate **`.page-shell__content`** only; header stays fixed.

---

## Major UI systems

### Navigation chrome

- **`SiteHeader`** (`components/SiteHeader/`): Logo, tabs (Home, Browse, Mii Creator), theme toggle (light/dark), auth menu, notifications (staff announcements, notification panel).
- **`BottomBar`** (`components/BottomBar/`): Mobile-oriented actions (pattern varies by page).
- **`SiteFooter`** (`components/SiteFooter/`): Links (including legal), secondary navigation.

### Social and engagement

- **Yeah** / favorites / stats: `services/social.ts`, `utils/favorites.ts`, `utils/yeahCache.ts` (legacy storage migration in `main.ts`).
- **Comments**: `components/CommentSection/`.
- **Share/embed/QR**: `components/ShareActions/`, `EmbedModal/`, `QRDisplayModal/`, `utils/share.ts`.

### Mii authoring and submission

- **QR scan pipeline**: `jsqr` + `miijs`; `services/scanSubmit.ts`; controls with `data-scan-submit`.
- **Editor**: `components/MiiMaker/`, `services/miiEditor.ts`, navigation helpers `miiMakerNavigate.ts`, `remixNavigate.ts`.
- **Rendering**: Three.js–related chunks appear in production builds for preview paths; `MiiRenderer` drives display.

### Moderation and safety

- **Reports**: `services/reports.ts`, modals, admin report queues.
- **Roles**: `UserRole`, `ContentVisibility`, restrictions — see `src/types.ts` and admin services.

---

## Backend and data

- **Supabase client**: `src/services/supabase.ts` (config via `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **Schema application**: `npm run dev` runs `scripts/sync-db.mjs`, which applies `supabase/sync.sql` and selected migrations via Supabase CLI / `DATABASE_URL`.
- **Auth session**: `initAuth()` before router; `LoginModal` for gated routes.
- **Profile gate**: `profileGate.ts` ensures **gamertag** (and related profile completion) before create/remix flows.

---

## Languages and tooling

| Technology | Usage |
| ---------- | ----- |
| **TypeScript** (strict, ES modules) | All application logic (`tsconfig.json`: `strict`, `verbatimModuleSyntax`, no emit — Vite bundles) |
| **CSS** | Variables, component files, no Tailwind |
| **SQL** | Schema in `supabase/` |
| **Vite 8** | Dev server, production bundle, `@` → `src` alias |
| **Vitest** | Unit tests in `tests/` |
| **Node scripts** | `scripts/sync-db.mjs`, `scripts/generate-tl-item-names.mjs` |

### Dependencies (runtime)

- `@supabase/supabase-js` — data and auth
- `miijs` — Mii binary/QR handling
- `jsqr` — QR decoding
- `@fortawesome/fontawesome-free` — icons (solid set imported in `main.ts`)

### Optional integrations

- **Plausible-compatible analytics**: `VITE_ANALYTICS_SCRIPT_URL` loads a deferred script; `trackEvent` calls `window.plausible` if present.

---

## Build and run

| Command | Effect |
| ------- | ------ |
| `npm run dev` | DB sync then Vite dev server |
| `npm run build` | `tsc` then `vite build` → `dist/` |
| `npm test` | Vitest run |
| `npm run db:sync` | Schema sync only |

---

## File layout (conceptual)

```
src/
  main.ts              # Boot
  router.ts            # Hash routing table
  types.ts             # Shared domain types
  pages/               # Route screens + page-level CSS
  components/          # Reusable UI (each folder: *.ts + *.css)
  layout/              # pageShell, inner layouts
  services/            # Supabase, API, domain orchestration
  styles/              # variables, globals, animations, icons, logo
  utils/               # routing helpers, motion, meta, escape, etc.
supabase/              # sync.sql, migrations
scripts/               # db sync, codegen
public/                # static assets, manifest, favicon
```

This should be enough for an agent to know **where to look** for a feature (e.g. new route → `router.ts` + new `pages/*.ts`; new control style → `variables.css` + component CSS).
