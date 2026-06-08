import './embedShell.css';
import { BRAND_NAME, SITE_URL } from '@/config/brand';

export function wrapEmbedPage(content: HTMLElement): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'embed-shell';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'embed-shell__content';
  contentWrap.appendChild(content);

  const footer = document.createElement('footer');
  footer.className = 'embed-shell__footer';

  const brandLink = document.createElement('a');
  brandLink.className = 'embed-shell__brand interactive';
  brandLink.href = SITE_URL;
  brandLink.target = '_blank';
  brandLink.rel = 'noopener noreferrer';
  brandLink.textContent = BRAND_NAME;

  const tagline = document.createElement('span');
  tagline.className = 'embed-shell__tagline';
  tagline.textContent = 'Browse & share Mii QR codes';

  footer.append(brandLink, tagline);
  shell.append(contentWrap, footer);
  return shell;
}
