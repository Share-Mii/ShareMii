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

  const credits = document.createElement('p');
  credits.className = 'site-footer__credits';
  credits.innerHTML = `
    <span class="site-footer__brand">${logoMark('site-footer__logo', { size: 'sm' })} ShareMii</span>
    · Mii rendering by
    <a href="https://mii-unsecure.ariankordi.net/" target="_blank" rel="noopener noreferrer">Arian Kordi Mii Renderer</a>
    · Built with
    <a href="https://github.com/Stewared/miijs" target="_blank" rel="noopener noreferrer">MiiJS</a>
  `;

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

  const discordUrl = getDiscordInviteUrl();
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

  inner.append(credits, nav, disclaimer);
  footer.appendChild(inner);
  return footer;
}
