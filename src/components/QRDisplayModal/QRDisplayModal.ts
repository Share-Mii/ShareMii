import './QRDisplayModal.css';
import '@/components/shared.css';
import { generateMiiQrPng, qrDeviceLabel } from '@/services/miiQr';
import type { Mii } from '@/types';
import { icon } from '@/utils/icon';

export function openQRDisplayModal(mii: Mii): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'qr-display-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'qr-display-title');

  const modal = document.createElement('div');
  modal.className = 'qr-display-modal';

  modal.innerHTML = `
    <div class="qr-display-modal__header">
      <div>
        <h2 id="qr-display-title" class="qr-display-modal__title">Mii QR Code</h2>
        <p class="qr-display-modal__subtitle">Scan with ${escapeHtml(qrDeviceLabel(mii))} to save ${escapeHtml(mii.name)}</p>
      </div>
      <button type="button" class="qr-display-modal__close interactive" aria-label="Close">${icon('xmark')}</button>
    </div>
    <p class="qr-display-modal__loading">Generating QR code…</p>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let objectUrl: string | null = null;

  const close = (): void => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };

  document.addEventListener('keydown', onKeyDown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  modal.querySelector('.qr-display-modal__close')?.addEventListener('click', close);

  generateMiiQrPng(mii)
    .then((blob) => {
      objectUrl = URL.createObjectURL(blob);

      modal.innerHTML = `
        <div class="qr-display-modal__header">
          <div>
            <h2 id="qr-display-title" class="qr-display-modal__title">Mii QR Code</h2>
            <p class="qr-display-modal__subtitle">Scan with ${escapeHtml(qrDeviceLabel(mii))} to save ${escapeHtml(mii.name)}</p>
          </div>
          <button type="button" class="qr-display-modal__close interactive" aria-label="Close">${icon('xmark')}</button>
        </div>
        <div class="qr-display-modal__frame">
          <img src="${objectUrl}" alt="QR code for ${escapeAttr(mii.name)}" width="320" height="320" />
        </div>
        <p class="qr-display-modal__hint">Open the Mii QR scanner on your ${escapeHtml(qrDeviceLabel(mii))}, point at this code, then confirm to save the Mii.</p>
        <div class="qr-display-modal__actions">
          <a class="pill-btn pill-btn--filled interactive" href="${objectUrl}" download="${escapeAttr(mii.name.replace(/[^a-z0-9]/gi, '_'))}_qr.png">Save image</a>
          <button type="button" class="pill-btn interactive" data-close>Close</button>
        </div>
      `;

      modal.querySelector('.qr-display-modal__close')?.addEventListener('click', close);
      modal.querySelector('[data-close]')?.addEventListener('click', close);
    })
    .catch((err: unknown) => {
      console.error('QR generation failed:', err);
      const loading = modal.querySelector('.qr-display-modal__loading');
      if (loading) {
        loading.className = 'qr-display-modal__error';
        loading.textContent =
          err instanceof Error && err.message
            ? `Could not generate QR code: ${err.message}`
            : 'Could not generate QR code. Try again later.';
      }
    });

  return close;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
