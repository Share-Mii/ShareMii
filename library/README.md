# ShareMii.net — AI & contributor library

This folder is the long-term knowledge base for humans and AI agents working on ShareMii.net. Read these docs before changing copy, visual design, release notes, or product scope.

## Start here

| Document | When to read |
| -------- | ------------ |
| [PRODUCT.md](./PRODUCT.md) | Mission, audience, feature map, what we are / are not |
| [BRAND.md](./BRAND.md) | Visual design system — colors, type, spacing, motion, UI patterns |
| [COPY.md](./COPY.md) | Voice, tone, terminology, changelog & Discord release-note style |
| [SEO.md](./SEO.md) | Crawler SEO, indexing rules, brand disambiguation for search |
| [AI_GUIDE.md](./AI_GUIDE.md) | How future agents should use this library and avoid common mistakes |

## Quick facts

- **Brand string:** ShareMii.net (not bare "ShareMii" in public UI)
- **One-liner:** Community Mii QR code gallery and free online Mii Maker for 3DS, Wii U, and Tomodachi Life
- **Not us:** [Living the Dream save editor](https://sharemii.qwkuns.me/) — always disambiguate when the name "ShareMii" appears
- **Design direction:** Nintendo-adjacent — friendly, rounded, pastel, plaza-like; never impersonate Nintendo branding
- **Source of truth for tokens:** [`src/styles/variables.css`](../src/styles/variables.css)
- **Source of truth for brand constants:** [`src/config/brand.ts`](../src/config/brand.ts) and [`worker/data/brand.ts`](../worker/data/brand.ts)

## Related setup docs

- OAuth: [OAUTH_SETUP.md](./OAUTH_SETUP.md) (referenced from root README)

## Updating this library

When you ship a meaningful product, brand, or copy change:

1. Update the relevant doc in the same PR (or immediately after).
2. Keep code and docs in sync — if tokens move, update BRAND.md tables.
3. Prefer additive detail over deleting history; strike through outdated guidance if needed.
