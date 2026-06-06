import './SiteFooter.css';
import { getDiscordInviteUrl } from '@/config/community';
import { logoMark } from '@/utils/logo';

const LEGAL_LINKS = [
  { href: '#/legal', label: 'Legal' },
  { href: '#/privacy', label: 'Privacy Policy' },
  { href: '#/terms', label: 'Terms of Service' },
  { href: '#/child-safety', label: 'Child Safety' },
  { href: '#/delete-account', label: 'Delete Account' },
] as const;

let bugReportOpener: (() => void) | null = null;

export function setBugReportOpener(opener: () => void): void {
  bugReportOpener = opener;
}

export function createSiteFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const inner = document.createElement('div');
  inner.className = 'site-footer__inner';

  const discordUrl = getDiscordInviteUrl();

  const credits = document.createElement('p');
  credits.className = 'site-footer__credits';
  credits.innerHTML = `
    <span class="site-footer__brand">${logoMark('site-footer__logo', { size: 'sm' })} ShareMii</span>
    · Mii rendering by
    <a href="https://mii-unsecure.ariankordi.net/" target="_blank" rel="noopener noreferrer">Arian Kordi Mii Renderer</a>
    · Built with
    <a href="https://github.com/Stewared/miijs" target="_blank" rel="noopener noreferrer">MiiJS</a>
  `;

  const compactNav = document.createElement('nav');
  compactNav.className = 'site-footer__compact';
  compactNav.setAttribute('aria-label', 'Footer links');
  const legalHub = document.createElement('a');
  legalHub.href = '#/legal';
  legalHub.className = 'site-footer__compact-link interactive';
  legalHub.textContent = 'Legal';
  compactNav.appendChild(legalHub);
  if (discordUrl) {
    const discordCompact = document.createElement('a');
    discordCompact.href = discordUrl;
    discordCompact.target = '_blank';
    discordCompact.rel = 'noopener noreferrer';
    discordCompact.className = 'site-footer__compact-link interactive';
    discordCompact.textContent = 'Discord';
    compactNav.appendChild(discordCompact);
  }
  const bugCompact = document.createElement('button');
  bugCompact.type = 'button';
  bugCompact.className =
    'site-footer__compact-link interactive site-footer__bug-btn';
  bugCompact.textContent = 'Bug report';
  bugCompact.addEventListener('click', () => bugReportOpener?.());
  compactNav.appendChild(bugCompact);

  const nav = document.createElement('nav');
  nav.className = 'site-footer__legal';
  nav.setAttribute('aria-label', 'Legal');

  for (const link of LEGAL_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    a.className = 'site-footer__legal-link interactive';
    a.textContent = link.label;
    nav.appendChild(a);
  }

  const bugBtn = document.createElement('button');
  bugBtn.type = 'button';
  bugBtn.className = 'site-footer__legal-link interactive site-footer__bug-btn';
  bugBtn.textContent = 'Report a bug';
  bugBtn.addEventListener('click', () => bugReportOpener?.());
  nav.appendChild(bugBtn);

  if (discordUrl) {
    const discord = document.createElement('a');
    discord.href = discordUrl;
    discord.target = '_blank';
    discord.rel = 'noopener noreferrer';
    discord.className = 'site-footer__legal-link interactive site-footer__discord';
    discord.textContent = 'Discord';
    nav.appendChild(discord);
  }

  const disclaimer = document.createElement('p');
  disclaimer.className = 'site-footer__disclaimer';
  disclaimer.textContent = 'Not affiliated with Nintendo Co., Ltd.';

  inner.append(credits, compactNav, nav, disclaimer);
  footer.appendChild(inner);
  return footer;
}
