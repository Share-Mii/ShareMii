import { openQRScanner } from '@/components/QRScanner/QRScanner';
import {
  closeSubmitModal,
  openSubmitModal,
} from '@/components/SubmitModal/SubmitModal';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { registerScanAndSubmitCleanup } from '@/services/miiUploadNavigate';
import { requireGamertag } from '@/services/profileGate';
import type { DecodedQrMii } from '@/types';

let activeCleanup: (() => void) | null = null;

function runActiveCleanup(): void {
  activeCleanup?.();
  activeCleanup = null;
  registerScanAndSubmitCleanup(null);
}

export function closeScanAndSubmit(): void {
  runActiveCleanup();
}

export interface ScanAndSubmitOptions {
  onSuccess?: (miiId: string) => void;
}

function submitQueueSequentially(
  queue: DecodedQrMii[],
  index: number,
  options: ScanAndSubmitOptions,
  onModalChange: (cleanup: (() => void) | undefined) => void,
): void {
  if (index >= queue.length) return;

  const cleanup = openSubmitModal(queue[index]!, {
    onSuccess: (miiId) => {
      options.onSuccess?.(miiId);
      submitQueueSequentially(queue, index + 1, options, onModalChange);
    },
    onCancel: () => {
      submitQueueSequentially(queue, index + 1, options, onModalChange);
    },
  });
  onModalChange(cleanup);
}

export async function openScanAndSubmit(
  options: ScanAndSubmitOptions = {},
): Promise<void> {
  const session = await getAuthSession();
  if (!isLoggedIn(session)) {
    openLoginModal();
    return;
  }

  const ready = await requireGamertag();
  if (!ready) return;

  closeScanAndSubmit();

  const queue: DecodedQrMii[] = [];
  let cleanupModal: (() => void) | undefined;

  function scanLoop(): void {
    const cleanupScanner = openQRScanner({
      onSuccess: (decoded) => {
        const duplicate = queue.some(
          (item) => item.miiDataBase64 === decoded.miiDataBase64,
        );
        if (!duplicate) {
          queue.push(decoded);
        }
        const scanMore = window.confirm(
          duplicate
            ? 'This Mii is already in the queue. Scan another QR code?'
            : `${queue.length} Mii${queue.length === 1 ? '' : 's'} in queue. Scan another QR code?`,
        );
        if (scanMore) {
          scanLoop();
          return;
        }
        submitQueueSequentially(queue, 0, options, (c) => {
          cleanupModal = c;
        });
      },
      onCancel: () => {},
    });

    activeCleanup = () => {
      cleanupScanner();
      cleanupModal?.();
      closeSubmitModal();
    };
    registerScanAndSubmitCleanup(activeCleanup);
  }

  scanLoop();
}

export function bindScanAndSubmit(el: HTMLElement): void {
  el.setAttribute('data-scan-submit', '');
  el.addEventListener('click', (e) => {
    e.preventDefault();
    void openScanAndSubmit();
  });
}

export function initScanSubmitTriggers(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-scan-submit]');
    if (!el) return;
    e.preventDefault();
    void openScanAndSubmit();
  });
}
