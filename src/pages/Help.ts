import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { BRAND_NAME, formatBrandTitle } from '@/config/brand';
import { DEFAULT_OG_IMAGE, setPageMeta } from '@/utils/pageMeta';

interface HelpSection {
  heading: string;
  steps: string[];
}

const SECTIONS: HelpSection[] = [
  {
    heading: 'Browse Mii QR codes',
    steps: [
      'Open Browse or stay on the home plaza to see community Miis.',
      'Filter by platform (3DS, Wii U, Tomodachi Life), tags, or sort by trending.',
      'Click a Mii to view its QR code, download it, or share a link.',
    ],
  },
  {
    heading: 'Scan and submit a Mii',
    steps: [
      'Sign in and complete your gamertag in Settings if prompted.',
      'Use Scan & Submit from the header or home page.',
      'Point your camera at a Mii QR code from 3DS, Wii U, or Tomodachi Life.',
      'Add a title or description, then publish to the community.',
    ],
  },
  {
    heading: 'Create a Mii online',
    steps: [
      'Open Mii Creator from the navigation bar.',
      'Customize face, hair, outfit, and other traits in the editor.',
      'Submit your Mii to share it, or export a QR code for your console.',
    ],
  },
  {
    heading: 'Yeah, save, and remix',
    steps: [
      'Yeah a Mii to show appreciation (like Miiverse).',
      'Save favorites when signed in to find them later.',
      'Remix a public Mii to start from someone else\'s design in the Mii Creator.',
    ],
  },
  {
    heading: 'Looking for something else?',
    steps: [
      'Tomodachi Life: Living the Dream save editing (.ltd files) is a different ShareMii tool — not this site.',
      'See About ShareMii.net for how this community site differs from that project.',
    ],
  },
];

export function renderHelp(container: HTMLElement): void {
  setPageMeta({
    title: formatBrandTitle('How to Use ShareMii'),
    description: `Learn how to browse, scan, create, and share Mii QR codes on ${BRAND_NAME}.`,
    url: `${window.location.origin}/help`,
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
  title.textContent = `How to use ${BRAND_NAME}`;

  const intro = document.createElement('p');
  intro.className = 'legal-page__intro';
  intro.textContent = `${BRAND_NAME} is a community for Mii QR codes — browse, scan, create, and share. You can explore without an account; signing in unlocks uploads, favorites, and your profile.`;

  const body = document.createElement('div');
  body.className = 'legal-page__body';

  for (const section of SECTIONS) {
    const block = document.createElement('section');
    block.className = 'legal-page__section';

    const heading = document.createElement('h2');
    heading.className = 'legal-page__heading';
    heading.textContent = section.heading;
    block.appendChild(heading);

    const list = document.createElement('ol');
    list.className = 'legal-page__list legal-page__list--ordered';
    for (const step of section.steps) {
      const li = document.createElement('li');
      li.textContent = step;
      list.appendChild(li);
    }
    block.appendChild(list);
    body.appendChild(block);
  }

  const aboutLink = document.createElement('p');
  aboutLink.className = 'legal-page__intro';
  const a = document.createElement('a');
  a.href = '/about';
  a.className = 'legal-page__link interactive';
  a.textContent = `About ${BRAND_NAME}`;
  aboutLink.append('Learn more on ', a, '.');
  body.appendChild(aboutLink);

  page.append(back, title, intro, body);
  container.replaceChildren(wrapPublicPage(page));
}
