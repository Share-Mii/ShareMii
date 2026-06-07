import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import {
  BRAND_NAME,
  DEFAULT_PUBLIC_DESCRIPTION,
  LIVING_THE_DREAM_GITHUB_URL,
  LIVING_THE_DREAM_TOOL_URL,
} from '@/config/brand';
import { ABOUT_SAFETY_BLURB } from '@/config/seo';
import { DEFAULT_OG_IMAGE, getSiteOrigin, setPageMeta } from '@/utils/pageMeta';

interface AboutSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

const SECTIONS: AboutSection[] = [
  {
    heading: 'What is ShareMii.net?',
    body: `${BRAND_NAME} is a community website for browsing, sharing, and creating Nintendo Miis. Scan Mii QR codes from a 3DS, Wii U, or Tomodachi Life, browse what others have shared, or build new Miis in the free online Mii Maker.`,
  },
  {
    heading: 'Not the Living the Dream save editor',
    body: `Another project is also called "ShareMii" — a browser tool for editing Tomodachi Life: Living the Dream save files (.ltd import/export with Checkpoint or JKSV). That tool is separate from ${BRAND_NAME}.`,
  },
  {
    heading: 'What you can do here',
    bullets: [
      'Browse and search community Mii QR codes',
      'Scan a QR code from your console and submit it to the plaza',
      'Create and customize Miis in your browser, then export QR codes',
      'Yeah, save, download, remix, and share Miis with others',
      'Follow creators and curate public collections',
    ],
  },
  {
    heading: 'Related links',
    bullets: [
      `How to use ${BRAND_NAME} — see the Help page`,
      'Living the Dream save editor (different tool)',
      'Original ShareMii Python project on GitHub',
    ],
  },
];

export function renderAbout(container: HTMLElement): void {
  setPageMeta({
    title: `About ${BRAND_NAME} — Is ShareMii Safe?`,
    description: `${ABOUT_SAFETY_BLURB} ${DEFAULT_PUBLIC_DESCRIPTION}`,
    url: `${getSiteOrigin()}/about`,
    image: DEFAULT_OG_IMAGE,
  });

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top legal-page';

  const back = document.createElement('a');
  back.href = '/';
  back.className = 'legal-page__back interactive';
  back.textContent = '← Back to plaza';

  const title = document.createElement('h1');
  title.className = 'legal-page__title';
  title.textContent = `About ${BRAND_NAME}`;

  const intro = document.createElement('p');
  intro.className = 'legal-page__intro';
  intro.textContent = DEFAULT_PUBLIC_DESCRIPTION;

  const body = document.createElement('div');
  body.className = 'legal-page__body';

  for (const section of SECTIONS) {
    const block = document.createElement('section');
    block.className = 'legal-page__section';

    const heading = document.createElement('h2');
    heading.className = 'legal-page__heading';
    heading.textContent = section.heading;
    block.appendChild(heading);

    if (section.body) {
      const text = document.createElement('p');
      text.textContent = section.body;
      block.appendChild(text);
    }

    if (section.bullets?.length) {
      const list = document.createElement('ul');
      list.className = 'legal-page__list';
      for (const item of section.bullets) {
        const li = document.createElement('li');
        if (section.heading === 'Related links') {
          if (item.startsWith('How to use')) {
            const a = document.createElement('a');
            a.href = '/help';
            a.className = 'legal-page__link interactive';
            a.textContent = `How to use ${BRAND_NAME}`;
            li.appendChild(a);
          } else if (item.startsWith('Living the Dream')) {
            const a = document.createElement('a');
            a.href = LIVING_THE_DREAM_TOOL_URL;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'legal-page__link interactive';
            a.textContent = 'Living the Dream save editor (sharemii.qwkuns.me)';
            li.appendChild(a);
          } else if (item.startsWith('Original')) {
            const a = document.createElement('a');
            a.href = LIVING_THE_DREAM_GITHUB_URL;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'legal-page__link interactive';
            a.textContent = 'Star-F0rce ShareMii on GitHub';
            li.appendChild(a);
          } else {
            li.textContent = item;
          }
        } else {
          li.textContent = item;
        }
        list.appendChild(li);
      }
      block.appendChild(list);
    }

    body.appendChild(block);
  }

  const helpCta = document.createElement('p');
  helpCta.className = 'legal-page__intro';
  const helpLink = document.createElement('a');
  helpLink.href = '/help';
  helpLink.className = 'legal-page__link interactive';
  helpLink.textContent = `How to use ${BRAND_NAME}`;
  helpCta.append('New here? Read ', helpLink, '.');
  body.appendChild(helpCta);

  page.append(back, title, intro, body);
  container.replaceChildren(wrapPublicPage(page));
}
