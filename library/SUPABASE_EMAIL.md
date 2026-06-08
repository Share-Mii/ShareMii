# Supabase auth email templates

ShareMii-branded HTML for Supabase Auth emails (signup confirmation, password reset, magic link, email change).

Design tokens match [`library/BRAND.md`](BRAND.md): accent `#0088ff`, sky hero gradient, Nunito-style typography, rounded tile panel.

## Template files

| Supabase type | File | Subject |
| ------------- | ---- | ------- |
| Confirm signup | `supabase/templates/confirmation.html` | Confirm your ShareMii.net account |
| Reset password | `supabase/templates/recovery.html` | Reset your ShareMii.net password |
| Magic link | `supabase/templates/magic_link.html` | Sign in to ShareMii.net |
| Change email | `supabase/templates/email_change.html` | Confirm your new email for ShareMii.net |

Templates use Go syntax: `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

## Local development

`supabase/config.toml` points each `[auth.email.template.*]` at the HTML files above. Restart local Supabase after editing:

```bash
supabase stop && supabase start
```

Sign up with a test address and check Inbucket (local mail catcher) at http://localhost:54324.

## Production (hosted Supabase)

Hosted projects do **not** automatically pick up repo templates. Apply them in the dashboard:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Email Templates**.
2. For each template type, set the **Subject** from the table above.
3. Open the matching file in this repo, copy the full HTML, and paste into the **Body** field.
4. Save each template.

Optional: set **Authentication** → **URL Configuration** → **Site URL** to `https://sharemii.net` so links in emails use production.

## Custom SMTP (recommended for production)

Default Supabase mail is rate-limited and may land in spam. For reliable delivery:

1. **Project Settings** → **Authentication** → **SMTP Settings** — enable custom SMTP (Resend, SendGrid, etc.).
2. Set **Sender email** to something like `noreply@sharemii.net` with matching SPF/DKIM on your domain.
3. Re-apply the HTML templates after switching SMTP if the dashboard cleared them.

## Testing checklist

- [ ] Sign up → confirmation email shows ShareMii branding and **Confirm email** button works
- [ ] Forgot password → recovery email matches branding
- [ ] Link opens `https://sharemii.net` (or local dev URL) and completes auth
- [ ] Plain-text fallback: link URL is visible below the button

## Related

- Redirect URLs: `.env.example` and `src/services/auth.ts` (`AUTH_REDIRECT_ORIGINS`)
- OAuth setup: configure providers in Dashboard (no extra env vars)
