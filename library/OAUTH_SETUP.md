# OAuth login setup (Google, GitHub, Discord)

ShareMii uses [Supabase Auth](https://supabase.com/docs/guides/auth) for sign-in and sign-up. The login modal supports:

- **Email + password** (Supabase Email provider)
- **Google**, **GitHub**, and **Discord** (OAuth via `signInWithOAuth` in `src/services/auth.ts`)

OAuth buttons appear on both **Sign in** and **Create account** in `src/components/LoginModal/LoginModal.ts`. No extra frontend env vars are required for OAuth — only Supabase Dashboard (or local CLI) provider configuration.

> **Not the same as the Discord community link.** `VITE_DISCORD_INVITE_URL` is an optional invite to your server (header/footer). **Discord OAuth** is a separate “Sign in with Discord” provider configured below.

---

## 1. Supabase redirect URLs (required for all providers)

After OAuth, Supabase redirects users back to your app. ShareMii passes the current page URL via `getAuthRedirectUrl()` in `src/services/auth.ts`, which only allows these origins:

| Environment | Allowed origins |
| ----------- | ---------------- |
| Local dev | `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173` (preview) |
| Production | `https://sharemii.net`, `https://www.sharemii.net` |

In the [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration**:

1. **Site URL** — production: `https://sharemii.net`; local-only testing: `http://localhost:5173`
2. **Redirect URLs** — add every URL from the table above (and your preview host if different)

`supabase/config.toml` mirrors these for local Supabase CLI (`[auth]` section).

Each OAuth app (Google, GitHub, Discord) must also register Supabase’s **callback URL** (next section).

---

## 2. Supabase OAuth callback URL

Every provider redirects to Supabase first, not directly to ShareMii. **Google, GitHub, and Discord all use the same callback** — paste it into each provider’s “Redirect URI” / “Callback URL” field.

### ShareMii (hosted project `bejtwsdmmvgpjcolnqdx`)

```text
https://bejtwsdmmvgpjcolnqdx.supabase.co/auth/v1/callback
```

| Provider | Where to paste it |
| -------- | ----------------- |
| **Google** | Cloud Console → Credentials → OAuth client → **Authorized redirect URIs** |
| **Discord** | Developer Portal → OAuth2 → **Redirects** |
| **GitHub** | OAuth App → **Authorization callback URL** |

You can also copy it from Dashboard → **Authentication** → **Sign In / Providers** → any provider → **Callback URL (for OAuth)**.

### Local Supabase only (`supabase start`)

If you test OAuth against a local Auth instance (not the hosted project above), use:

```text
http://localhost:54321/auth/v1/callback
```

Do not mix hosted and local callback URLs in the same OAuth app unless you maintain separate apps per environment.

---

## 3. Google

### Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project
2. **APIs & Services** → **OAuth consent screen** — set **App name** to `ShareMii`, **Homepage** / **Privacy policy** to `https://sharemii.net`, upload your logo, and add scopes (`email`, `profile`, `openid`). Users still see “continue to …supabase.co” in the domain line (see [Google consent screen branding](#google-consent-screen-branding-sharemiinet-vs-supabaseco) below).
3. **Credentials** → **Create credentials** → **OAuth client ID** → type **Web application**
4. **Authorized JavaScript origins** (optional for Supabase-hosted callback flow; add if Google asks):
   - `http://localhost:5173`
   - `https://sharemii.net`
5. **Authorized redirect URIs** — add the Supabase callback from §2 (hosted and local if you use both)
6. Copy **Client ID** and **Client secret**

### Supabase

Dashboard → **Authentication** → **Providers** → **Google**:

- Enable Google
- Paste Client ID and Client secret → **Save**

Docs: [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)

### Google consent screen branding (sharemii.net vs supabase.co)

If Google says **“Choose an account to continue to `bejtwsdmmvgpjcolnqdx.supabase.co`”** instead of ShareMii, that is **normal** with the default Supabase Auth URL. Google shows the host of the OAuth **redirect URI** (where Google sends the user after login), which is always your Supabase project:

```text
https://bejtwsdmmvgpjcolnqdx.supabase.co/auth/v1/callback
```

ShareMii’s site URL (`https://sharemii.net`) is only used *after* Supabase finishes auth (`redirectTo` in the app). Google does not display that on the consent screen.

**What you can do without paying for Supabase add-ons**

- **OAuth consent screen** → **App name** = `ShareMii`, logo, links to `https://sharemii.net` — the headline reads “Sign in to ShareMii” even if the small print still mentions `supabase.co`.
- **Authorized domains** (if you verify `sharemii.net` in Search Console): add `sharemii.net` on the consent screen. This does not replace the `supabase.co` redirect line.

**To show `sharemii.net` (or `auth.sharemii.net`) on the consent screen**

Use a [Supabase custom domain](https://supabase.com/docs/guides/platform/custom-domains) (paid add-on on a paid plan), e.g. `api.sharemii.net` or `auth.sharemii.net`:

1. Dashboard → **Project Settings** → **General** → **Custom Domains** (DNS CNAME + TXT verification).
2. Add the new callback to Google: `https://auth.sharemii.net/auth/v1/callback` (keep the old one until cutover).
3. After activation, set `VITE_SUPABASE_URL` (and GitHub Actions secrets) to the custom domain.
4. Google’s “continue to …” line will show your subdomain instead of `bejtwsdmmvgpjcolnqdx.supabase.co`.

This is optional polish; OAuth works correctly with the default `*.supabase.co` domain.

---

## 4. GitHub

### GitHub Developer Settings

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. **Application name** — e.g. `ShareMii`
3. **Homepage URL** — `https://sharemii.net` (or `http://localhost:5173` for dev-only app)
4. **Authorization callback URL** — Supabase callback from §2 (one app can use the production callback; use a second OAuth app for local `localhost:54321` if needed)
5. Copy **Client ID**; generate a **Client secret**

### Supabase

Dashboard → **Authentication** → **Providers** → **GitHub**:

- Enable GitHub
- Paste Client ID and Client secret → **Save**

Docs: [Login with GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github)

---

## 5. Discord

### Discord Developer Portal

1. [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. **OAuth2** → **Redirects** → **Add Redirect**
3. Paste the Supabase callback URL from §2 → **Save Changes**
4. Copy **Client ID** and **Client Secret** (under OAuth2 → Client information)

### Supabase

Dashboard → **Authentication** → **Providers** → **Discord**:

- Enable Discord
- Paste Client ID and Client secret → **Save**

Docs: [Login with Discord](https://supabase.com/docs/guides/auth/social-login/auth-discord)

---

## 6. Email + password (optional baseline)

Dashboard → **Authentication** → **Providers** → **Email**:

- Enable **Email** provider for password sign-in/sign-up
- Configure **Confirm email** if you want verification before first login

ShareMii uses `signUpWithPassword` / `signInWithPassword` with `emailRedirectTo` set to `getAuthRedirectUrl()`.

---

## 7. Local development checklist

1. `.env.local` from `.env.example`:

   ```env
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
   ```

2. Supabase **Redirect URLs** include `http://localhost:5173` and `http://127.0.0.1:5173`
3. Each OAuth app’s redirect/callback lists your Supabase callback (§2)
4. Run `npm run dev` and open the login modal → try each provider

If OAuth fails with “redirect URL not allowed”, compare the browser URL origin with `AUTH_REDIRECT_ORIGINS` in `src/services/auth.ts` and Supabase **Redirect URLs**.

---

## 8. Production checklist

- [ ] Site URL = `https://sharemii.net`
- [ ] Redirect URLs include production hosts (and `www` if used)
- [ ] Google/GitHub/Discord apps use production homepage and Supabase **production** callback
- [ ] GitHub Actions secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`)
- [ ] Test sign-in and sign-up from the deployed site (OAuth returns to the same route/hash)

---

## 9. Troubleshooting

### Supabase: “Google/GitHub isn’t enabled”

This is **only** a Dashboard toggle — the ShareMii app cannot enable providers for you.

1. [Supabase Dashboard](https://supabase.com/dashboard/project/bejtwsdmmvgpjcolnqdx/auth/providers) → **Authentication** → **Providers**
2. Expand **Google** (or **GitHub**) → set **Enable** to ON
3. Paste **Client ID** and **Client secret** from Google Cloud / GitHub OAuth App
4. Click **Save** at the bottom of that provider panel (not just the accordion)

Repeat for each provider. Until this is saved, the login modal will error even if Google/GitHub consoles are configured correctly.

### Discord: “Invalid OAuth2 redirect_uri”

Discord validates `redirect_uri` in the authorize URL against **OAuth2 → Redirects** on the **same application** as `client_id`.

Your authorize URL uses:

```text
client_id=1506939244625657866
redirect_uri=https://bejtwsdmmvgpjcolnqdx.supabase.co/auth/v1/callback
```

Fix in [Discord Developer Portal](https://discord.com/developers/applications):

1. Open the app whose **Client ID** is `1506939244625657866` (not a different ShareMii/bot app)
2. **OAuth2** → **Redirects** → **Add Redirect**
3. Paste **exactly** (no trailing slash, no spaces):

   ```text
   https://bejtwsdmmvgpjcolnqdx.supabase.co/auth/v1/callback
   ```

4. **Save Changes** (bottom of OAuth2 page)
5. In Supabase → **Providers** → **Discord**: same Client ID + Client secret, **Enabled** ON → **Save**

Common mistakes:

| Mistake | Why it fails |
| ------- | ------------- |
| Added `https://sharemii.net/...` in Discord | Discord needs the **Supabase** callback, not your site URL |
| Trailing slash: `.../callback/` | Must match character-for-character |
| Redirect on wrong Discord app | `client_id` in the URL must match the app you edited |
| Forgot **Save Changes** in Discord | Redirect list not persisted |

### Other issues

| Symptom | Likely fix |
| ------- | ---------- |
| `Provider is not enabled` | Turn on the provider in Supabase Dashboard and save credentials |
| Lands on wrong site after login | Add your origin to Supabase Redirect URLs and `AUTH_REDIRECT_ORIGINS` |
| User created but no profile | Ensure DB migrations ran (`npm run dev` syncs schema); profile trigger is in `supabase/migrations/002_profiles.sql` |
| Discord works in prod but not locally | Add `http://localhost:54321/auth/v1/callback` to Discord redirects when using Supabase CLI |

---

## 10. Code reference

| Piece | Location |
| ----- | -------- |
| OAuth sign-in | `signInWithProvider()` in `src/services/auth.ts` |
| Allowed redirect origins | `AUTH_REDIRECT_ORIGINS`, `getAuthRedirectUrl()` |
| Login UI | `src/components/LoginModal/LoginModal.ts` |
| Env template | `.env.example` |

New OAuth providers: extend `OAuthProvider` in `auth.ts`, add a button in `LoginModal.ts`, and configure the provider in Supabase + the vendor’s developer console.
