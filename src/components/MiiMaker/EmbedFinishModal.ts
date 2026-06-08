import './EmbedFinishModal.css';
import '@/components/shared.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import {
  buildPlazaUploadUrl,
  saveMakerDraft,
} from '@/services/makerDraft';
import {
  generateQrPngFromDecoded,
  qrDeviceLabelForDecoded,
} from '@/services/miiQr';
import { icon } from '@/utils/icon';
import type { DecodedQrMii, Platform } from '@/types';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/modalScrollLock';

export function openEmbedFinishModal(decoded: DecodedQrMii): () => void {
  let selectedPlatform: Platform =
    decoded.suggestedPlatform ?? (decoded.isTomodachiLife ? '3ds' : '3ds');

  const overlay = document.createElement('div');
  overlay.className = 'embed-finish-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'embed-finish-title');

  const modal = document.createElement('div');
  modal.className = 'embed-finish-modal';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'embed-finish-modal__close interactive';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('xmark');

  const header = document.createElement('header');
  header.className = 'embed-finish-modal__header';
  header.innerHTML = `
    <div>
      <h2 id="embed-finish-title" class="embed-finish-modal__title">Your Mii is ready!</h2>
      <p class="embed-finish-modal__subtitle">Save the QR code for your Nintendo console, or share on ShareMii Plaza.</p>
    </div>
  `;
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'embed-finish-modal__body';

  const previewCol = document.createElement('div');
  previewCol.className = 'embed-finish-modal__preview-col';
  previewCol.appendChild(
    createMiiRenderer({
      miiData: decoded.miiDataBase64,
      width: 200,
      alt: `${decoded.name ?? 'Mii'} preview`,
      platform: selectedPlatform,
    }),
  );

  const qrCol = document.createElement('div');
  qrCol.className = 'embed-finish-modal__qr-col';
  qrCol.innerHTML = `<p class="embed-finish-modal__loading">Generating QR code…</p>`;

  body.append(previewCol, qrCol);

  const plazaSection = document.createElement('div');
  plazaSection.className = 'embed-finish-modal__plaza';

  const plazaHeading = document.createElement('p');
  plazaHeading.className = 'embed-finish-modal__plaza-heading';
  plazaHeading.textContent = 'Upload to ShareMii Plaza?';

  const plazaHint = document.createElement('p');
  plazaHint.className = 'embed-finish-modal__plaza-hint';
  plazaHint.textContent =
    'Share your Mii with the community — browse, yeah, remix, and collect QR codes on ShareMii.net.';

  const plazaBtn = document.createElement('a');
  plazaBtn.className = 'pill-btn pill-btn--filled interactive embed-finish-modal__plaza-btn';
  plazaBtn.href = buildPlazaUploadUrl();
  plazaBtn.target = '_blank';
  plazaBtn.rel = 'noopener noreferrer';
  plazaBtn.innerHTML = `${icon('share-nodes')} Upload to ShareMii Plaza`;

  plazaSection.append(plazaHeading, plazaHint, plazaBtn);

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'pill-btn interactive embed-finish-modal__back';
  backBtn.textContent = 'Keep editing';

  modal.append(header, body, plazaSection, backBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  lockBodyScroll();

  let objectUrl: string | null = null;

  const dismiss = (): void => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
    unlockBodyScroll();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') dismiss();
  };

  document.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });
  closeBtn.addEventListener('click', dismiss);
  backBtn.addEventListener('click', dismiss);

  plazaBtn.addEventListener('click', () => {
    saveMakerDraft({ ...decoded, suggestedPlatform: selectedPlatform });
  });

  generateQrPngFromDecoded(decoded, selectedPlatform)
    .then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      const name = (decoded.name ?? 'Mii').replace(/[^a-z0-9]/gi, '_');
      const device = qrDeviceLabelForDecoded(decoded, selectedPlatform);

      qrCol.innerHTML = `
        <div class="embed-finish-modal__qr-frame">
          <img src="${objectUrl}" alt="QR code for ${escapeAttr(decoded.name ?? 'Mii')}" width="280" height="280" />
        </div>
        <p class="embed-finish-modal__qr-hint">Scan with your ${escapeHtml(device)} to save this Mii.</p>
        <a class="pill-btn pill-btn--filled interactive" href="${objectUrl}" download="${escapeAttr(name)}_qr.png">Save QR code</a>
      `;
    })
    .catch((err: unknown) => {
      qrCol.innerHTML = `<p class="embed-finish-modal__error">${
        err instanceof Error && err.message
          ? escapeHtml(err.message)
          : 'Could not generate QR code. Try again.'
      }</p>`;
    });

  return dismiss;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
