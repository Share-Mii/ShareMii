import './EmbedModal.css';
import '@/components/shared.css';
import { copyToClipboard } from '@/utils/share';

let activeOverlay: HTMLElement | null = null;

function closeEmbedModal(): void {
  activeOverlay?.remove();
  activeOverlay = null;
}

export function openEmbedModal(embedHtml: string): void {
  closeEmbedModal();

  const overlay = document.createElement('div');
  overlay.className = 'embed-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Embed code');

  const modal = document.createElement('div');
  modal.className = 'embed-modal';

  const title = document.createElement('h2');
  title.className = 'embed-modal__title';
  title.textContent = 'Embed this Mii';

  const hint = document.createElement('p');
  hint.className = 'embed-modal__hint';
  hint.textContent =
    'Paste this HTML on forums, blogs, or Discord (where HTML is supported).';

  const textarea = document.createElement('textarea');
  textarea.className = 'embed-modal__code';
  textarea.readOnly = true;
  textarea.value = embedHtml;
  textarea.setAttribute('aria-label', 'Embed HTML');

  const actions = document.createElement('div');
  actions.className = 'embed-modal__actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'pill-btn pill-btn--filled interactive';
  copyBtn.textContent = 'Copy code';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pill-btn pill-btn--outline interactive';
  closeBtn.textContent = 'Close';

  const close = (): void => closeEmbedModal();

  copyBtn.addEventListener('click', async () => {
    if (await copyToClipboard(embedHtml)) {
      copyBtn.textContent = 'Copied!';
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy code';
      }, 2000);
    }
  });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey, { once: true });

  actions.append(copyBtn, closeBtn);
  modal.append(title, hint, textarea, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
  textarea.focus();
  textarea.select();
}
