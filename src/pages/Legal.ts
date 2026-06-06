import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/config/legal';
import { DEFAULT_OG_IMAGE, setPageMeta } from '@/utils/pageMeta';

type LegalPageId =
  | 'legal'
  | 'privacy'
  | 'terms'
  | 'child-safety'
  | 'delete-account';

interface LegalSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

interface LegalPageConfig {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT = LEGAL_CONTACT_EMAIL;

const PAGES: Record<LegalPageId, LegalPageConfig> = {
  legal: {
    title: 'Legal',
    intro: `Legal information and policies for ShareMii. Last updated ${LEGAL_LAST_UPDATED}.`,
    sections: [
      {
        heading: 'Policies',
        body: 'Use the links below for our Privacy Policy, Terms of Service, Child Safety standards, and account deletion information.',
      },
      {
        heading: 'Your data rights',
        body: 'Signed-in users can download a copy of their data and delete their account from Settings. For other requests, contact us at the address below.',
      },
      {
        heading: 'Contact',
        body: `Privacy, legal, and account requests: ${CONTACT}`,
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `This Privacy Policy explains how ShareMii ("we", "us") collects, uses, and protects your information. Last updated ${LEGAL_LAST_UPDATED}.`,
    sections: [
      {
        heading: 'Who we are',
        body: 'ShareMii is a community website for sharing Mii characters. We operate the service at sharemii.net and related subdomains.',
      },
      {
        heading: 'Information we collect',
        bullets: [
          'Account data: email address and authentication identifiers when you register or sign in (including via OAuth providers such as Google, GitHub, or Discord).',
          'Profile data: gamertag, bio, avatar, banner, and notification preferences you provide in Settings.',
          'Content you submit: Mii data, titles, descriptions, comments, collections, favorites, and related metadata.',
          'Usage data: view, download, and favorite counts; technical logs needed to operate and secure the service.',
          'Reports you file: content reports and bug reports, including optional details you provide.',
          'Device and browser data: page URL and user agent when you submit a bug report (to help us reproduce issues).',
        ],
      },
      {
        heading: 'How we use information',
        bullets: [
          'Provide, maintain, and improve ShareMii.',
          'Authenticate users and enforce our Terms of Service.',
          'Send in-app notifications according to your preferences.',
          'Review reports, moderate content, and respond to safety concerns.',
          'Comply with law and protect users, our service, and third parties.',
        ],
      },
      {
        heading: 'Legal bases (where applicable)',
        body: 'If you are in the European Economic Area or United Kingdom, we process personal data based on: performance of our contract with you (providing the service); legitimate interests (security, moderation, analytics in aggregate); and your consent where required (for example, optional communications).',
      },
      {
        heading: 'Third-party services',
        bullets: [
          'Supabase: authentication, database, and file storage for profile media.',
          'OAuth providers: when you choose social sign-in, those providers process data under their own policies.',
          'Mii rendering libraries: Miis are rendered using third-party code and services; only data needed for display is sent.',
          'Optional analytics: if enabled, we may use a privacy-friendly analytics script (see site configuration).',
        ],
      },
      {
        heading: 'Retention',
        body: 'We keep account and content data while your account is active. When you delete your account, we remove your profile, authentication record, and associated personal data. Some content may be retained in backups for a limited period or where required by law. Aggregated or anonymized data may be kept longer.',
      },
      {
        heading: 'Your rights and choices',
        bullets: [
          'Access and export: in Settings, use "Download my data" to receive a JSON export of information tied to your account.',
          'Correction: update your gamertag, bio, and images in Settings.',
          'Deletion: delete your account in Settings (see Delete Account policy).',
          'Notifications: control comment, yeah, and favorite notifications in Settings.',
          'Object or restrict processing, or lodge a complaint with a supervisory authority, where applicable law provides these rights.',
        ],
      },
      {
        heading: 'Children',
        body: 'ShareMii is not directed at children under 13 (or the minimum age in your country). We do not knowingly collect personal information from children. See our Child Safety page for more.',
      },
      {
        heading: 'Security',
        body: 'We use industry-standard measures including encrypted connections, access controls, and row-level security on our database. No method of transmission or storage is 100% secure.',
      },
      {
        heading: 'International transfers',
        body: 'Your data may be processed in countries where our service providers operate. We rely on appropriate safeguards where required by law.',
      },
      {
        heading: 'Changes',
        body: 'We may update this policy. We will post the revised version on this page with an updated date. Continued use after changes constitutes acceptance where permitted by law.',
      },
      {
        heading: 'Contact',
        body: `Privacy questions and data subject requests: ${CONTACT}`,
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: `By using ShareMii, you agree to these Terms of Service. Last updated ${LEGAL_LAST_UPDATED}.`,
    sections: [
      {
        heading: 'Eligibility',
        body: 'You must be old enough to consent to these terms in your jurisdiction and not prohibited from using the service under applicable law.',
      },
      {
        heading: 'Your account',
        bullets: [
          'You are responsible for activity on your account and for keeping your credentials secure.',
          'Your gamertag and profile must comply with our content rules and must not impersonate others.',
          'We may suspend or terminate accounts that violate these terms or pose risk to the community.',
        ],
      },
      {
        heading: 'Your content',
        bullets: [
          'You retain ownership of content you submit. You grant ShareMii a non-exclusive license to host, display, and distribute your content on the service.',
          'You represent that you have the rights to share your Miis and comments and that they do not infringe third-party rights.',
          'Do not upload illegal, harassing, hateful, sexually exploitative, or otherwise harmful material.',
          'Do not upload malware, spam, or content intended to disrupt the service.',
        ],
      },
      {
        heading: 'Community standards',
        body: 'Use the Report feature for problematic Miis, comments, or profiles. Use Report a bug for technical issues. We may remove content, restrict features, or ban users at our discretion.',
      },
      {
        heading: 'Intellectual property',
        body: 'ShareMii, its branding, and site code are owned by us or our licensors. Nintendo trademarks and Mii-related assets belong to their respective owners; ShareMii is not affiliated with Nintendo Co., Ltd.',
      },
      {
        heading: 'Third-party services',
        body: 'The service integrates third-party authentication, hosting, and Mii rendering. Your use of those features may be subject to additional third-party terms.',
      },
      {
        heading: 'Disclaimer',
        body: 'ShareMii is provided "as is" without warranties of any kind, to the fullest extent permitted by law. We do not guarantee uninterrupted or error-free operation.',
      },
      {
        heading: 'Limitation of liability',
        body: 'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data or profits arising from your use of the service.',
      },
      {
        heading: 'Indemnity',
        body: 'You agree to indemnify and hold us harmless from claims arising from your content or misuse of the service, to the extent permitted by law.',
      },
      {
        heading: 'Termination',
        body: 'You may stop using ShareMii at any time and delete your account in Settings. We may suspend or terminate access for violations or operational reasons.',
      },
      {
        heading: 'Governing law',
        body: 'These terms are governed by the laws applicable to the operator of ShareMii, without regard to conflict-of-law rules. Disputes will be resolved in the courts of that jurisdiction unless mandatory consumer protections in your country require otherwise.',
      },
      {
        heading: 'Contact',
        body: `Legal inquiries: ${CONTACT}`,
      },
    ],
  },
  'child-safety': {
    title: 'Child Safety',
    intro: `ShareMii is a community for sharing Mii characters. We take safety seriously. Last updated ${LEGAL_LAST_UPDATED}.`,
    sections: [
      {
        heading: 'Minimum age',
        body: 'ShareMii is not intended for children under 13. Users under the applicable age of consent in their region should not create an account without parental permission.',
      },
      {
        heading: 'Prohibited conduct',
        bullets: [
          'Do not target minors with harmful, sexual, or exploitative content.',
          'Do not groom, solicit, or share personal contact information with minors through the service.',
          'Do not impersonate minors or adults in a deceptive way.',
        ],
      },
      {
        heading: 'Reporting',
        body: 'If you see content that endangers a child, use Report on the Mii, comment, or profile and select "Child safety concern." For urgent danger, contact local authorities immediately, then email us at the address below.',
      },
      {
        heading: 'Parental guidance',
        body: 'Parents and guardians should supervise younger users\' online activity and discuss what is appropriate to share publicly.',
      },
      {
        heading: 'Enforcement',
        body: 'We prioritize child-safety reports, may escalate to law enforcement where required, and will remove accounts that violate these standards.',
      },
      {
        heading: 'Contact',
        body: `Child safety reports and questions: ${CONTACT}`,
      },
    ],
  },
  'delete-account': {
    title: 'Delete Account',
    intro: `How to remove your ShareMii account and associated data. Last updated ${LEGAL_LAST_UPDATED}.`,
    sections: [
      {
        heading: 'Delete in Settings',
        body: 'Sign in, open Settings, and scroll to "Your data & account." Click "Delete my account," confirm by entering your gamertag, and submit. Deletion is permanent and cannot be undone.',
      },
      {
        heading: 'What is removed',
        bullets: [
          'Your authentication record and profile (gamertag, bio, avatar, banner).',
          'Miis, comments, collections, favorites, follows, and notifications tied to your account.',
          'Profile media stored for your account.',
          'Bug reports and content reports you filed (reporter identity is removed).',
        ],
      },
      {
        heading: 'What may remain',
        body: 'Anonymized or aggregated statistics, moderation audit entries that reference your user ID for staff records, and short-term backups may persist for a limited period as described in our Privacy Policy.',
      },
      {
        heading: 'Before you delete',
        body: 'Use "Download my data" in Settings if you want a copy of your information for your records.',
      },
      {
        heading: 'Email requests',
        body: `If you cannot access your account, contact ${CONTACT} from the email address on the account with your gamertag and a deletion request. We may ask for additional verification.`,
      },
    ],
  },
};

function buildLegalPage(id: LegalPageId): HTMLElement {
  const config = PAGES[id];
  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top legal-page';

  const back = document.createElement('a');
  back.href = '/';
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
        li.textContent = item;
        list.appendChild(li);
      }
      block.appendChild(list);
    }

    body.appendChild(block);
  }

  if (id === 'legal') {
    const links = document.createElement('nav');
    links.className = 'legal-page__links';
    links.setAttribute('aria-label', 'Legal documents');
    for (const [pageId, pageConfig] of Object.entries(PAGES)) {
      if (pageId === 'legal') continue;
      const a = document.createElement('a');
      a.href = `/${pageId}`;
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
  const config = PAGES[id];
  setPageMeta({
    title: config.title,
    description: config.intro,
    url: `${window.location.origin}/${id}`,
    image: DEFAULT_OG_IMAGE,
  });
  container.replaceChildren(wrapPublicPage(buildLegalPage(id)));
}

export function isLegalPageId(id: string): id is LegalPageId {
  return id in PAGES;
}
