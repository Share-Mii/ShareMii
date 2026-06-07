import { openQRScanner } from '@/components/QRScanner/QRScanner';
import {
  closeSubmitModal,
  openSubmitModal,
} from '@/components/SubmitModal/SubmitModal';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { registerScanAndSubmitCleanup } from '@/services/miiUploadNavigate';
import { requireGamertag } from '@/services/profileGate';

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

  let cleanupModal: (() => void) | undefined;

  const cleanupScanner = openQRScanner({
    onSuccess: (decoded) => {
      cleanupModal = openSubmitModal(decoded, {
        onSuccess: (miiId) => {
          options.onSuccess?.(miiId);
        },
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
