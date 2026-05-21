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
2. **APIs & Services** → **OAuth consent screen** — configure app name, support email, and scopes (`email`, `profile`, `openid` are enough for login)
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

| Symptom | Likely fix |
| ------- | ---------- |
| `Provider is not enabled` | Turn on the provider in Supabase Dashboard |
| Redirect / callback mismatch | Callback in Google/GitHub/Discord must match Supabase exactly (scheme, host, path) |
| Lands on wrong site after login | Add your origin to Supabase Redirect URLs and `AUTH_REDIRECT_ORIGINS` |
| `Invalid redirect_uri` from provider | OAuth app missing Supabase `/auth/v1/callback` URL |
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
