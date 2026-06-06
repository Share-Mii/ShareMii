# ShareMii

A modern Mii sharing community website with a Wii-inspired design. Browse, yeah, save, and download Miis shared by the community. Submit Miis via QR code camera scan or the in-browser Mii Maker.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   **Social login (Google, GitHub, Discord):** see [library/OAUTH_SETUP.md](library/OAUTH_SETUP.md) for Supabase and provider console setup.

   Optional analytics:

   ```
   VITE_ANALYTICS_SCRIPT_URL=https://plausible.io/js/script.js
   ```

3. **Set up the database**

   Schema is applied via [`scripts/sync-db.mjs`](scripts/sync-db.mjs), which runs:

   - [`supabase/sync.sql`](supabase/sync.sql)
   - [`supabase/migrations/015_admin_foundation.sql`](supabase/migrations/015_admin_foundation.sql)
   - [`supabase/migrations/016_reports_and_moderation.sql`](supabase/migrations/016_reports_and_moderation.sql)
   - [`supabase/migrations/017_roadmap_features.sql`](supabase/migrations/017_roadmap_features.sql)

   **`npm run dev` runs `db:sync` first** against your linked Supabase project.

4. **Start development**

   ```bash
   npm run dev
   ```

5. **Tests**

   ```bash
   npm test
   ```

6. **Production build**

   ```bash
   npm run build
   npm run preview
   ```

## Features

- **Home** (`#/`) — Plaza grid, spotlight, trending sort, following strip (links to full feed)
- **Feed** (`#/feed`) — Activity timeline from follows (yeahs, uploads, comments, remixes, collections) with filters; **Latest uploads** tab shows a Mii grid from people you follow
- **Browse** (`#/browse`) — Search Miis and creators, platform/gender/tag filters, trending sort
- **Tag pages** (`#/tag/:slug`) — Browse by tag (cosplay, game, funny, etc.)
- **Detail** (`#/mii/:id`) — Expressions, yeah, favorite, collections, share/embed, remix lineage, comments with @mentions, Open Graph previews
- **Create** (`#/create`) — In-browser Mii Maker; remix and edit flows
- **Submit** — QR scan modal via `data-scan-submit` or `#/submit`
- **Profiles** (`#/u/:username`) — Follow, block/mute, pins, collections, public activity
- **Collections** — Private/public lists; discover public collections at `#/collections/browse`
- **Creator dashboard** (`#/dashboard`) — Upload and engagement stats
- **Settings** — Privacy (hide profile), blocked users, notifications, data export, account delete
- **Admin** — Reports, appeals, bugs, auto-mod, users, audit (staff)

## Mii rendering API

Renders use [mii-unsecure.ariankordi.net](https://mii-unsecure.ariankordi.net) via `src/services/miiApi.ts` (Switch / 3DS / Wii body types on detail pages).

## QR submission

Miis are submitted by scanning a Mii QR code from a 3DS, Wii U, Switch, or Tomodachi Life. The app uses `jsQR` and `miijs`. Batch scan queues multiple Miis before submitting metadata.

## Tech stack

- Vite + TypeScript (strict)
- Vanilla TS (no framework)
- Supabase (Postgres + Auth + Realtime)
- Hand-crafted component CSS
