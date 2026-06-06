import './QRScanner.css';
import '@/components/shared.css';
import { icon } from '@/utils/icon';
import jsQR from 'jsqr';
import {
  decodeQrPayload,
  extractQrBytes,
  scanQrFromCanvas,
  scanQrFromImageFile,
} from '@/services/qrDecode';
import type { DecodedQrMii } from '@/types';

export interface QRScannerCallbacks {
  onSuccess: (decoded: DecodedQrMii) => void;
  onCancel: () => void;
}

const INVALID_MII_MSG =
  'This QR code does not contain a valid Mii. Supports 3DS, Wii U, Switch, and Tomodachi Life Mii QR codes.';

export function openQRScanner(callbacks: QRScannerCallbacks): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'qr-scanner-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Scan Mii QR code');

  let stream: MediaStream | null = null;
  let rafId = 0;
  let closed = false;
  let processing = false;

  function close(): void {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(rafId);
    stream?.getTracks().forEach((t) => t.stop());
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  }

  function cancel(): void {
    close();
    callbacks.onCancel();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') cancel();
  }

  document.addEventListener('keydown', onKeyDown);

  function showError(message: string): void {
    overlay.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'qr-scanner-modal';
    modal.innerHTML = `
      <div class="qr-scanner-error">
        <div class="qr-scanner-error__icon" aria-hidden="true">${icon('camera')}</div>
        <p class="qr-scanner-error__msg">${message}</p>
        <button type="button" class="pill-btn pill-btn--filled" data-action="close">Go back</button>
      </div>
    `;
    modal.querySelector('[data-action="close"]')?.addEventListener('click', cancel);
    overlay.appendChild(modal);
  }

  async function handleDecodedBytes(
    binary: Uint8Array,
    status: HTMLElement,
  ): Promise<void> {
    if (processing || closed) return;
    processing = true;
    status.textContent = 'QR detected! Decoding…';
    closed = true;
    cancelAnimationFrame(rafId);
    stream?.getTracks().forEach((t) => t.stop());

    try {
      const decoded = await decodeQrPayload(binary);
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
      callbacks.onSuccess(decoded);
    } catch {
      try {
        status.textContent = 'Retrying with enhanced scan…';
        const canvas = document.createElement('canvas');
        const video = overlay.querySelector('video') as HTMLVideoElement | null;
        if (!video) throw new Error('no video');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        const rescanned = await scanQrFromCanvas(canvas);
        const decoded = await decodeQrPayload(rescanned);
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
        callbacks.onSuccess(decoded);
      } catch {
        processing = false;
        closed = false;
        showError(INVALID_MII_MSG);
      }
    }
  }

  async function startCamera(): Promise<void> {
    const modal = document.createElement('div');
    modal.className = 'qr-scanner-modal';

    modal.innerHTML = `
      <div class="qr-scanner-modal__header">
        <h2 class="qr-scanner-modal__title">Scan Mii QR Code</h2>
        <button type="button" class="qr-scanner-modal__close interactive" aria-label="Close">${icon('xmark')}</button>
      </div>
      <div class="qr-scanner-viewfinder">
        <video playsinline muted autoplay></video>
        <div class="qr-scanner-guide" aria-hidden="true"></div>
      </div>
      <p class="qr-scanner-status">Point your camera at a Mii QR code (3DS, Wii U, Switch, or Tomodachi Life)</p>
      <div class="qr-scanner-upload">
        <button type="button" class="qr-scanner-upload__btn interactive" data-action="upload">or upload a QR code</button>
        <input type="file" accept="image/*" class="qr-scanner-upload__input" hidden />
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('.qr-scanner-modal__close')?.addEventListener('click', cancel);

    const status = modal.querySelector('.qr-scanner-status') as HTMLElement;

    const fileInput = modal.querySelector(
      '.qr-scanner-upload__input',
    ) as HTMLInputElement;
    modal
      .querySelector('[data-action="upload"]')
      ?.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file || processing || closed) return;
      void (async () => {
        try {
          const binary = await scanQrFromImageFile(file);
          await handleDecodedBytes(binary, status);
        } catch {
          if (!processing) showError(INVALID_MII_MSG);
        }
      })();
    });

    const video = modal.querySelector('video')!;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let frameCount = 0;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
    } catch {
      showError(
        'Camera access was denied or no camera was found. Please allow camera permissions and try again.',
      );
      return;
    }

    function scheduleNextFrame(): void {
      if (closed || processing) return;
      rafId = requestAnimationFrame(() => {
        void tick();
      });
    }

    async function tick(): Promise<void> {
      if (closed || processing) return;

      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        scheduleNextFrame();
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      frameCount += 1;

      if (frameCount % 15 === 0) {
        try {
          const scanned = await scanQrFromCanvas(canvas);
          await handleDecodedBytes(scanned, status);
          return;
        } catch {
          /* continue with fast jsQR path */
        }
      }

      if (closed || processing) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code) {
        const binary = extractQrBytes(code);
        if (binary?.length) {
          await handleDecodedBytes(binary, status);
          return;
        }
      }

      scheduleNextFrame();
    }

    tick();
  }

  startCamera();

  return () => {
    close();
  };
}
