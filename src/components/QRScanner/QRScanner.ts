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
import { lockBodyScroll, unlockBodyScroll } from '@/utils/modalScrollLock';

export interface QRScannerCallbacks {
  onSuccess: (decoded: DecodedQrMii) => void;
  onCancel: () => void;
}

const INVALID_MII_MSG =
  'This QR code does not contain a valid Mii. Supports 3DS, Wii U, Switch, and Tomodachi Life Mii QR codes.';

const UNREADABLE_IMAGE_MSG =
  'Could not read a QR code from that image. Photos of screens often fail because of glare or moiré — try a direct screenshot, crop tightly to the QR code, or use the live camera instead.';

/** Max edge length for live jsQR frames (full-res decode uses miijs separately). */
const SCAN_MAX_DIM = 640;
/** Run jsQR every N animation frames to keep the scan-line animation smooth. */
const JSQR_FRAME_INTERVAL = 3;
/** Run the heavier miijs canvas scan every N jsQR attempts. */
const MIJS_SCAN_INTERVAL = 12;

function fitScanDimensions(width: number, height: number): { width: number; height: number } {
  const maxDim = Math.max(width, height);
  if (maxDim <= SCAN_MAX_DIM) return { width, height };
  const scale = SCAN_MAX_DIM / maxDim;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

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
  /** True while an uploaded image is being decoded (separate from `processing`). */
  let fileUploadActive = false;
  /** Bumped when uploads start or the modal closes — ignores in-flight getUserMedia. */
  let cameraGeneration = 0;

  function close(): void {
    if (closed) return;
    closed = true;
    stopScanLoop();
    overlay.remove();
    unlockBodyScroll();
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

  function stopScanLoop(): void {
    cancelAnimationFrame(rafId);
    rafId = 0;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  function showError(message: string): void {
    stopScanLoop();
    processing = false;
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
    retryCanvas?: HTMLCanvasElement,
  ): Promise<void> {
    if (processing || closed) return;
    processing = true;
    status.textContent = 'QR detected! Decoding…';
    closed = true;
    stopScanLoop();

    try {
      const decoded = await decodeQrPayload(binary);
      overlay.remove();
      unlockBodyScroll();
      document.removeEventListener('keydown', onKeyDown);
      callbacks.onSuccess(decoded);
    } catch {
      try {
        status.textContent = 'Retrying with enhanced scan…';
        let canvas = retryCanvas;
        if (!canvas) {
          const video = overlay.querySelector('video') as HTMLVideoElement | null;
          if (!video) throw new Error('no video');
          canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d')!.drawImage(video, 0, 0);
        }
        const rescanned = await scanQrFromCanvas(canvas);
        const decoded = await decodeQrPayload(rescanned);
        overlay.remove();
        unlockBodyScroll();
        document.removeEventListener('keydown', onKeyDown);
        callbacks.onSuccess(decoded);
      } catch {
        processing = false;
        closed = false;
        showError(INVALID_MII_MSG);
      }
    }
  }

  function beginFileUpload(status: HTMLElement): void {
    cameraGeneration += 1;
    fileUploadActive = true;
    stopScanLoop();
    status.textContent = 'Reading image…';
  }

  async function startCamera(): Promise<void> {
    const generation = ++cameraGeneration;
    const modal = document.createElement('div');
    modal.className = 'qr-scanner-modal';

    modal.innerHTML = `
      <div class="qr-scanner-modal__header">
        <h2 class="qr-scanner-modal__title">Scan Mii QR Code</h2>
        <button type="button" class="qr-scanner-modal__close interactive" aria-label="Close">${icon('xmark')}</button>
      </div>
      <div class="qr-scanner-viewfinder">
        <video playsinline muted autoplay></video>
        <div class="qr-scanner-shade" aria-hidden="true"></div>
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
    lockBodyScroll();

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
      if (!file || processing || closed || fileUploadActive) return;
      beginFileUpload(status);
      void (async () => {
        try {
          status.textContent = 'Scanning QR code…';
          const { bytes, canvas } = await scanQrFromImageFile(file);
          fileUploadActive = false;
          await handleDecodedBytes(bytes, status, canvas);
        } catch (err) {
          const unreadable =
            err instanceof Error &&
            (/No QR code found/i.test(err.message) || /timed out/i.test(err.message));
          showError(unreadable ? UNREADABLE_IMAGE_MSG : INVALID_MII_MSG);
        } finally {
          fileUploadActive = false;
        }
      })();
    });

    const video = modal.querySelector('video')!;
    const scanCanvas = document.createElement('canvas');
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true })!;
    const fullCanvas = document.createElement('canvas');
    const fullCtx = fullCanvas.getContext('2d')!;

    let frameCount = 0;
    let jsqrAttempts = 0;
    let heavyScanPending = false;
    let scanWidth = 0;
    let scanHeight = 0;
    let fullWidth = 0;
    let fullHeight = 0;

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (closed || processing || fileUploadActive || generation !== cameraGeneration) {
        nextStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = nextStream;
      video.srcObject = stream;
      await video.play();
      if (closed || processing || fileUploadActive || generation !== cameraGeneration) {
        stopScanLoop();
        return;
      }
    } catch {
      if (generation !== cameraGeneration || closed) return;
      showError(
        'Camera access was denied or no camera was found. Please allow camera permissions and try again.',
      );
      return;
    }

    function scheduleNextFrame(): void {
      if (closed || processing || fileUploadActive || !stream) return;
      rafId = requestAnimationFrame(tick);
    }

    function ensureScanCanvasSize(videoWidth: number, videoHeight: number): void {
      const next = fitScanDimensions(videoWidth, videoHeight);
      if (next.width !== scanWidth || next.height !== scanHeight) {
        scanWidth = next.width;
        scanHeight = next.height;
        scanCanvas.width = scanWidth;
        scanCanvas.height = scanHeight;
      }
      if (videoWidth !== fullWidth || videoHeight !== fullHeight) {
        fullWidth = videoWidth;
        fullHeight = videoHeight;
        fullCanvas.width = fullWidth;
        fullCanvas.height = fullHeight;
      }
    }

    function runHeavyScan(): void {
      if (heavyScanPending || closed || processing || fileUploadActive) return;
      heavyScanPending = true;
      void (async () => {
        try {
          if (closed || processing || video.readyState !== video.HAVE_ENOUGH_DATA) return;
          ensureScanCanvasSize(video.videoWidth, video.videoHeight);
          fullCtx.drawImage(video, 0, 0);
          const scanned = await scanQrFromCanvas(fullCanvas);
          await handleDecodedBytes(scanned, status);
        } catch {
          /* fall back to jsQR on later frames */
        } finally {
          heavyScanPending = false;
        }
      })();
    }

    function tick(): void {
      if (closed || processing || fileUploadActive || !stream) return;

      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        scheduleNextFrame();
        return;
      }

      frameCount += 1;
      if (frameCount % JSQR_FRAME_INTERVAL !== 0) {
        scheduleNextFrame();
        return;
      }

      ensureScanCanvasSize(video.videoWidth, video.videoHeight);
      scanCtx.drawImage(video, 0, 0, scanWidth, scanHeight);

      jsqrAttempts += 1;
      if (jsqrAttempts % MIJS_SCAN_INTERVAL === 0) {
        runHeavyScan();
      }

      const imageData = scanCtx.getImageData(0, 0, scanWidth, scanHeight);
      let code: ReturnType<typeof jsQR> = null;
      try {
        code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
      } catch {
        scheduleNextFrame();
        return;
      }

      if (code) {
        const binary = extractQrBytes(code);
        if (binary?.length) {
          void handleDecodedBytes(binary, status);
          return;
        }
      }

      scheduleNextFrame();
    }

    if (!closed && !processing && !fileUploadActive && generation === cameraGeneration) {
      scheduleNextFrame();
    }
  }

  startCamera();

  return () => {
    close();
  };
}
