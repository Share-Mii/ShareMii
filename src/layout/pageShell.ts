import { createBottomBar } from '@/components/BottomBar/BottomBar';
import { createSiteFooter } from '@/components/SiteFooter/SiteFooter';
import { createSiteHeader } from '@/components/SiteHeader/SiteHeader';

let persistentHeader: HTMLElement | null = null;
let persistentFooter: HTMLElement | null = null;
let persistentBottomBar: HTMLElement | null = null;

export function wrapPublicPage(content: HTMLElement): HTMLElement {
  if (!persistentHeader) {
    persistentHeader = createSiteHeader();
    persistentFooter = createSiteFooter();
    persistentBottomBar = createBottomBar();
  }

  const shell = document.createElement('div');
  shell.className = 'page-shell page-shell--with-bottom-bar';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'page-shell__content';
  contentWrap.appendChild(content);

  persistentHeader.remove();
  persistentFooter!.remove();
  persistentBottomBar!.remove();
  shell.append(
    persistentHeader,
    contentWrap,
    persistentFooter!,
    persistentBottomBar!,
  );
  return shell;
}
