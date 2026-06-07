# ShareMii.net — product vision & scope

## North star

**ShareMii.net is the one-stop home for the Mii community.**

Everything a Mii fan needs — browse, share, create, collect, follow creators, and discover — should live here or link clearly from here. We are building the plaza the community never got after Miiverse: welcoming, searchable, and built around QR codes and the Mii format.

## What we are

| Pillar | Description |
| ------ | ----------- |
| **Gallery & plaza** | Public grid of community Mii QR codes with search, tags, platforms, and trending |
| **Creation** | Free in-browser Mii Maker; export QR codes for supported Nintendo platforms |
| **Submission** | Scan a Mii QR code from 3DS, Wii U, or Tomodachi Life and publish to the community |
| **Social** | Yeahs, favorites, follows, comments, remix lineage, collections, activity feed |
| **Discovery** | Tags, spotlight, browse, public collections, creator profiles |
| **Trust** | Moderation, reports, safety copy, clear disambiguation from unrelated "ShareMii" tools |

## What we are not

- **Not** a Nintendo official product — fan/community site; say so in safety and About copy
- **Not** the [Tomodachi Life: Living the Dream save editor](https://sharemii.qwkuns.me/) — different product, same colloquial name; always clarify
- **Not** a Switch save editor or general save-file tool
- **Not** a place to distribute copyrighted game assets unrelated to Miis

## Supported platforms (Mii QR focus)

Primary messaging targets:

- Nintendo 3DS
- Wii U
- Tomodachi Life

Detail pages may render additional body types via the Mii API (e.g. Switch-style previews). Marketing copy should stay accurate to what users can scan and submit today.

## Audience

- **Collectors** — want a searchable library of community Miis
- **Creators** — make Miis in-browser or on-console and share QR codes
- **Nostalgia / Miiverse refugees** — familiar verbs (Yeah, plaza, residents)
- **Tomodachi / Wii U / 3DS players** — practical QR workflow

## Feature map (high level)

| Area | Route / entry | Notes |
| ---- | ------------- | ----- |
| Home plaza | `/` | Hero, spotlight, filters, following strip |
| Browse | `/browse` | Search, sort, platform/gender/tag filters |
| Mii detail | `/mii/:id` | QR, yeah, favorite, remix, comments, share |
| Mii Creator | `/create` | In-browser editor; remix & edit flows |
| Scan & submit | Header / `#/submit` | Camera QR scan |
| Feed | `/feed` | Following activity (noindex) |
| Profiles | `/u/:username` | Follow, collections, pins |
| Collections | `/collections/browse`, user collections | Public discovery |
| Tags | `/tags`, `/tag/:slug` | Themed browsing |
| Help / About | `/help`, `/about` | Onboarding + brand disambiguation |
| Settings / admin | `/settings`, `/admin` | Account & staff tools |

See root [README.md](../README.md) for developer-oriented feature list.

## Product principles

1. **Community first** — public Miis and creators are the hero; tools support sharing.
2. **Low friction** — browse without an account; sign-in unlocks social actions.
3. **Console-honest** — explain what works on which hardware; no overpromising.
4. **Safe & moderated** — reports, review, and clear safety language on About/Help.
5. **One hub** — deep links, tags, collections, and profiles keep people on-site instead of scattered Discords and Drive folders.
6. **Delight without clutter** — Nintendo-adjacent warmth (see [BRAND.md](./BRAND.md)), not noisy gamification.

## Roadmap mindset (non-binding)

Future AI agents should interpret these as direction, not commitments:

- Richer creator tools (dashboard, analytics already started)
- Better discovery (spotlight, trending, tag ecosystems)
- Deeper Mii ecosystem links (guides, platform tips, community events)
- Release notes and changelog as a first-class community touchpoint
- SEO and LLM discoverability ([SEO.md](./SEO.md), `public/llms.txt`)

## Competitive / adjacent projects

| Project | Relationship |
| ------- | ------------ |
| Living the Dream ShareMii (save editor) | Same name, different tool — link out, never merge branding |
| Original ShareMii Python (GitHub) | Historical / related; credit in About |
| mii-unsecure.ariankordi.net | Mii render API dependency |
| Miiverse (defunct) | Spiritual predecessor for Yeah / plaza language |

## Success metrics (qualitative)

- Someone can answer "where do I find/share Miis?" with ShareMii.net
- Search and social snippets use **ShareMii.net** and correct descriptions
- New users understand Yeah, plaza, and QR workflow within one session
- Changelog voice feels like a friendly system update, not a corporate blog
