import './CreateImport.css';
import './pages.css';
import '@/components/shared.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import {
  closeSubmitModal,
  openSubmitModal,
} from '@/components/SubmitModal/SubmitModal';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { wrapPublicPage } from '@/layout/pageShell';
import { getAuthSession, isLoggedIn, subscribeAuth } from '@/services/auth';
import {
  clearMakerDraft,
  EMBED_MAKER_URL,
  loadMakerDraft,
} from '@/services/makerDraft';
import { requireGamertag } from '@/services/profileGate';
import { BRAND_NAME } from '@/config/brand';
import { getSiteOrigin, setPageMeta } from '@/utils/pageMeta';
import { navigateTo } from '@/utils/navigation';
import type { DecodedQrMii } from '@/types';

export function renderCreateImport(container: HTMLElement): () => void {
  const origin = getSiteOrigin();
  setPageMeta({
    title: 'Upload to ShareMii Plaza',
    description: `Finish uploading your Mii to the ${BRAND_NAME} community plaza.`,
    url: `${origin}/create?import=draft`,
    noindex: true,
  });

  let aborted = false;
  let unsubAuth: (() => void) | undefined;
  let cleanupModal: (() => void) | undefined;
  let draft: DecodedQrMii | null = loadMakerDraft();

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top create-import-page';

  const card = document.createElement('section');
  card.className = 'create-import-card';

  const title = document.createElement('h1');
  title.className = 'create-import-card__title';
  title.textContent = 'Upload to ShareMii Plaza';

  const status = document.createElement('p');
  status.className = 'create-import-card__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  card.append(title, status);
  page.append(card);
  container.replaceChildren(wrapPublicPage(page));

  function setStatus(message: string): void {
    status.textContent = message;
  }

  function renderPreview(decoded: DecodedQrMii): void {
    card.querySelector('.create-import-card__preview')?.remove();
    const previewWrap = document.createElement('div');
    previewWrap.className = 'create-import-card__preview';
    previewWrap.appendChild(
      createMiiRenderer({
        miiData: decoded.miiDataBase64,
        width: 240,
        alt: `${decoded.name ?? 'Mii'} preview`,
        platform: decoded.suggestedPlatform ?? '3ds',
      }),
    );
    card.insertBefore(previewWrap, status);
  }

  async function tryOpenSubmit(): Promise<void> {
    if (aborted) return;

    draft = loadMakerDraft();
    if (!draft) {
      setStatus('No Mii draft found. Create one in the Mii Maker first.');
      card.querySelector('.create-import-card__actions')?.remove();

      const actions = document.createElement('div');
      actions.className = 'create-import-card__actions';
      const makerLink = document.createElement('a');
      makerLink.className = 'pill-btn pill-btn--filled interactive';
      makerLink.href = EMBED_MAKER_URL;
      makerLink.textContent = 'Open Mii Maker';
      actions.appendChild(makerLink);
      card.appendChild(actions);
      return;
    }

    renderPreview(draft);

    const session = await getAuthSession();
    if (aborted) return;

    if (!isLoggedIn(session)) {
      setStatus('Sign in to upload your Mii to the plaza.');
      openLoginModal();
      return;
    }

    const ready = await requireGamertag();
    if (aborted) return;
    if (!ready) {
      setStatus('Finish setting up your profile to upload.');
      return;
    }

    const decoded = draft;
    clearMakerDraft();
    navigateTo('/create', true);

    setStatus('Ready to share — add a description and pick a platform.');
    cleanupModal?.();
    cleanupModal = openSubmitModal(decoded, {
      onCancel: () => {
        navigateTo('/');
      },
    });
  }

  unsubAuth = subscribeAuth((session) => {
    if (aborted || !isLoggedIn(session)) return;
    void tryOpenSubmit();
  });

  void tryOpenSubmit();

  return () => {
    aborted = true;
    unsubAuth?.();
    cleanupModal?.();
    closeSubmitModal();
  };
}
