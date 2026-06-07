/** Shared SEO copy and structured-data content (worker + client). */

export const OG_DEFAULT_WIDTH = 1200;
export const OG_DEFAULT_HEIGHT = 630;
export const MII_FACE_OG_SIZE = 512;

export const SITEMAP_STATIC_LASTMOD = '2026-06-06';

export const INDEXNOW_KEY = 'sharemii-indexnow-2026';

export interface FaqEntry {
  question: string;
  answer: string;
}

export const HELP_FAQ: FaqEntry[] = [
  {
    question: 'How do I use ShareMii.net?',
    answer:
      'Browse community Mii QR codes on the home plaza or Browse page, scan a QR code from your 3DS, Wii U, or Tomodachi Life to submit it, or open Mii Creator to build a new Mii and export a QR code.',
  },
  {
    question: 'Is ShareMii.net safe?',
    answer:
      'Yes. ShareMii.net is a moderated community site for sharing Nintendo Mii QR codes. It does not install software on your console, does not access save files, and is not affiliated with Nintendo.',
  },
  {
    question: 'Is this the Tomodachi Life save editor ShareMii?',
    answer:
      'No. Another unrelated project also called ShareMii edits Tomodachi Life: Living the Dream save files (.ltd). ShareMii.net is a Mii QR code gallery and online Mii Maker only.',
  },
  {
    question: 'How do I scan and submit a Mii QR code?',
    answer:
      'Sign in, open Scan & Submit, point your camera at a Mii QR code from 3DS, Wii U, or Tomodachi Life, add a name and optional description, then publish as Public.',
  },
  {
    question: 'Can I make a Mii online for free?',
    answer:
      'Yes. Open the free online Mii Maker at /create to customize a Mii in your browser and export a QR code for supported Nintendo platforms.',
  },
];

export const ABOUT_SAFETY_BLURB =
  'ShareMii.net is a moderated community website for Mii QR codes — not save-file editing software. Public Miis are reviewed, and private account pages stay out of search results.';

export function faqPageJsonLd(
  origin: string,
  entries: FaqEntry[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
    url: `${origin}/help`,
  };
}

export function itemListJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export const TAG_PLATFORM_BLURB =
  '3DS, Wii U, Switch-style, and Tomodachi Life Mii QR codes';
