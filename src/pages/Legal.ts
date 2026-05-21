import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';

type LegalPageId =
  | 'legal'
  | 'privacy'
  | 'terms'
  | 'child-safety'
  | 'delete-account';

interface LegalPageConfig {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
}

const PAGES: Record<LegalPageId, LegalPageConfig> = {
  legal: {
    title: 'Legal',
    intro: 'Legal information and policies for ShareMii.',
    sections: [
      {
        heading: 'Policies',
        body: 'Use the links below for our Privacy Policy, Terms of Service, Child Safety standards, and account deletion information.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'How ShareMii collects, uses, and protects your information.',
    sections: [
      {
        heading: 'Overview',
        body: 'ShareMii stores account information (such as email and gamertag) and content you submit (Mii data, comments, and related metadata) to operate the service. We use Supabase for authentication and data storage.',
      },
      {
        heading: 'Contact',
        body: 'For privacy questions or requests, contact the site operator through the channels listed on this site.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'Rules for using ShareMii.',
    sections: [
      {
        heading: 'Acceptable use',
        body: 'Do not upload illegal, harassing, or infringing content. You are responsible for Miis and comments you share. We may remove content or suspend accounts that violate these terms.',
      },
      {
        heading: 'Service',
        body: 'ShareMii is provided as-is. Features may change without notice. Mii rendering relies on third-party services and libraries.',
      },
    ],
  },
  'child-safety': {
    title: 'Child Safety',
    intro: 'ShareMii is a community for sharing Mii characters.',
    sections: [
      {
        heading: 'Safety',
        body: 'Do not target minors with harmful content. Use the in-app Report option on Miis, comments, or profiles, or contact the site operator. Parents and guardians should supervise younger users’ online activity.',
      },
      {
        heading: 'Content',
        body: 'User-submitted Miis and comments must follow our Terms of Service. We review in-app reports and act on valid concerns about unsafe or inappropriate material.',
      },
    ],
  },
  'delete-account': {
    title: 'Delete Account',
    intro: 'How to remove your ShareMii account and associated data.',
    sections: [
      {
        heading: 'Request deletion',
        body: 'Sign in, open your profile, and use account settings to request deletion when available. You may also contact the site operator to delete your account, gamertag, submitted Miis, and comments tied to your account.',
      },
      {
        heading: 'What is removed',
        body: 'After deletion, your profile and authentication record are removed. Public Miis you shared may be anonymized or removed according to our retention practices.',
      },
    ],
  },
};

function buildLegalPage(id: LegalPageId): HTMLElement {
  const config = PAGES[id];
  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top legal-page';

  const back = document.createElement('a');
  back.href = '#/';
  back.className = 'legal-page__back interactive';
  back.textContent = '← Back to plaza';

  const title = document.createElement('h1');
  title.className = 'legal-page__title';
  title.textContent = config.title;

  const intro = document.createElement('p');
  intro.className = 'legal-page__intro';
  intro.textContent = config.intro;

  const body = document.createElement('div');
  body.className = 'legal-page__body';

  for (const section of config.sections) {
    const block = document.createElement('section');
    block.className = 'legal-page__section';

    const heading = document.createElement('h2');
    heading.className = 'legal-page__heading';
    heading.textContent = section.heading;

    const text = document.createElement('p');
    text.textContent = section.body;

    block.append(heading, text);
    body.appendChild(block);
  }

  if (id === 'legal') {
    const links = document.createElement('nav');
    links.className = 'legal-page__links';
    links.setAttribute('aria-label', 'Legal documents');
    for (const [pageId, pageConfig] of Object.entries(PAGES)) {
      if (pageId === 'legal') continue;
      const a = document.createElement('a');
      a.href = `#/${pageId}`;
      a.className = 'legal-page__link interactive';
      a.textContent = pageConfig.title;
      links.appendChild(a);
    }
    body.appendChild(links);
  }

  page.append(back, title, intro, body);
  return page;
}

export function renderLegal(
  container: HTMLElement,
  id: LegalPageId,
): void {
  container.replaceChildren(wrapPublicPage(buildLegalPage(id)));
}

export function isLegalPageId(id: string): id is LegalPageId {
  return id in PAGES;
}
