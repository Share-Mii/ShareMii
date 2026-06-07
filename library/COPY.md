# ShareMii.net — voice, copy & changelog style

All user-facing text, release notes, Discord announcements, and SEO descriptions should sound like **one friendly Nintendo-style system** — clear, warm, and a little playful. Not corporate. Not meme-heavy. Not pretending to be Nintendo.

See [BRAND.md](./BRAND.md) for visual rules; this doc covers **words**.

---

## Voice pillars

| Pillar | Meaning | Example |
| ------ | ------- | ------- |
| **Welcoming** | Assume first-time Mii fans | "Browse without an account — sign in when you want to yeah or upload." |
| **Plain** | Short sentences, active verbs | "Point your camera at a Mii QR code." |
| **Honest** | Say what works on which console | "3DS, Wii U, and Tomodachi Life" — don't imply unsupported features |
| **Community** | People and Miis, not "content" | "Residents", "creators", "the plaza" |
| **Nostalgic (light)** | Miiverse / Wii era nods | Yeah, plaza — never trademarked slogans |

---

## Brand strings

| Context | Use |
| ------- | --- |
| Titles, header, footer, schema | **ShareMii.net** |
| Sentence mention | ShareMii.net (preferred) or "this site" |
| Filename / repo | ShareMii is fine internally |
| SEO title pattern | `{Topic} · ShareMii.net` or `{Topic} — ShareMii.net` |

**Always disambiguate** when "ShareMii" could mean the Living the Dream save editor:

> Another project is also called "ShareMii" — a browser tool for editing Tomodachi Life: Living the Dream save files. That tool is separate from ShareMii.net.

---

## Terminology (canonical)

Use these consistently in UI, Help, FAQs, and changelogs:

| Term | Meaning | Avoid |
| ---- | ------- | ----- |
| **Yeah** (noun/verb) | Appreciation on a Mii (Miiverse-style) | Like, favorite (for the yeah action), upvote |
| **Most Yeah'd** | Sort label for popular Miis | Most liked, top rated |
| **Plaza** | Home feed / community grid | Feed (for public browse), timeline |
| **Residents** | Community Miis (especially Browse CTA) | Users, assets, entries |
| **Mii Creator** | In-browser maker at `/create` | Mii Maker (unless "online Mii Maker" in SEO), editor app |
| **Scan & Submit** | QR upload flow | Upload modal only |
| **Remix** | Fork someone's Mii in the creator | Copy, steal, repost |
| **Collection** | Curated list of Miis | Playlist, folder |
| **Gamertag** | Public username | Display name (in user-facing steps) |

### Platform names

- Nintendo **3DS** (not "3ds" in titles)
- **Wii U** (not WiiU in prose)
- **Tomodachi Life** (spell out in marketing; "Tomodachi" ok in compact badges)

---

## UI copy patterns

### Headlines

- 2–6 words, sentence case or title case for hero lines
- Hero pattern: `{verb}, {verb}, & {verb}` + accent noun → "Browse, share, & collect **Miis.**"

### Buttons & CTAs

- Start with a verb: Browse Residents, Scan & Submit, Join Discord, Back to plaza
- Primary = one per screen region

### Empty states

- State what happened + one action
- Example: "No Miis match those filters." → link to Browse or clear filters

### Errors

- What went wrong + what to try — no blame, no error codes in user text unless Helpful

### Legal / safety

- Calm and factual ([`seo/content.ts`](../seo/content.ts) `ABOUT_SAFETY_BLURB`)
- "Moderated community", "not affiliated with Nintendo", "does not access save files"

---

## SEO & meta copy

- **Description template:** `{action/value prop} for 3DS, Wii U, and Tomodachi Life. Not a Switch save editor.`
- Include **ShareMii.net** in titles for brand queries
- Help/About target "is ShareMii safe" and save-editor disambiguation
- See [SEO.md](./SEO.md) for indexing rules

Shared copy lives in:

- `src/config/brand.ts` — `DEFAULT_PUBLIC_DESCRIPTION`
- `seo/content.ts` — FAQs, safety blurb
- `worker/data/meta.ts` — crawler titles

Keep worker and client descriptions aligned.

---

## Changelog & release notes

Changelogs should read like **friendly system update notes** — the tone of a Nintendo "what's new" screen: concise bullets, player-facing benefits first, technical detail second.

### Structure

```markdown
{One-sentence summary of the update — what players/creators gain.}

## New
- ...

## Improved
- ...

## Fixed
- ...
```

Optional sections: `## Changed`, `## Removed` (rare — call out breaking UX clearly)

### Voice rules

1. **Lead with the benefit** — "Browse loads faster on mobile" not "Refactored ListPager"
2. **Second person or neutral** — "You can now …" / "Remix links appear on …"
3. **Past tense for fixes** — "Fixed QR scan failing on Safari."
4. **No internal codenames** unless community-known (Discord, Mii Creator ok)
5. **Version line** — `ShareMii.net v1.2.3` in Discord title embed
6. **Typography** — plain ASCII preferred; `normalizeReleaseTypography` strips smart quotes and em dashes for Discord ([`scripts/releaseTypography.ts`](../scripts/releaseTypography.ts))

### Good vs bad

| Good | Bad |
| ---- | --- |
| "Yeah counts update instantly after you yeah a Mii." | "Implemented optimistic UI for favorites mutation." |
| "Mii Creator: hair color picker is easier to tap on phones." | "Shipped 44px touch targets on color swatches." |
| "Clarified on About that we're not the .ltd save editor." | "SEO disambiguation content update." |

### Discord embeds

Built by [`scripts/discordChangelogEmbeds.ts`](../scripts/discordChangelogEmbeds.ts):

- Summary appears as blockquote (`>` lines)
- Markdown body below; horizontal rules become visual separators
- Embed color: brand blue (`#0088ff` / decimal `8721663`) unless overridden
- Title prefix: `ShareMii.net Update` — `ShareMii.net Update — v{x.y.z}`

### In-app / site changelog (if shown)

Same sections as Discord; match BRAND spacing (reading width, section gaps).

---

## Examples by surface

### Home hero subtitle

> Browse Mii QR codes shared by the community, or scan a code from your 3DS, Wii U, or Tomodachi Life to share them with everyone.

### Help intro

> ShareMii.net is a community for Mii QR codes — browse, scan, create, and share. You can explore without an account; signing in unlocks uploads, favorites, and your profile.

### Detail back link

> Back to plaza

### Feed empty (signed in, no activity)

> Follow creators to see their yeahs, uploads, and remixes here. → Browse the plaza

---

## Localization (future)

Today: **American English**, straight quotes, Oxford comma optional but be consistent within a page.

When translating:

- Keep **Yeah** as a brand verb or gloss it explicitly
- Keep **ShareMii.net** untranslated
- Platform names stay official Nintendo English names unless Nintendo publishes localized console names

---

## Checklist before shipping copy

- [ ] Says ShareMii.net where the brand appears publicly
- [ ] Disambiguates save-editor ShareMii if the name appears alone
- [ ] Uses Yeah / plaza / Residents / Mii Creator consistently
- [ ] No false Nintendo affiliation
- [ ] Changelog bullets are player-facing, not commit-message dumps
- [ ] Meta description matches `DEFAULT_PUBLIC_DESCRIPTION` tone
