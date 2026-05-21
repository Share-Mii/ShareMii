import { closeSubmitModal } from '@/components/SubmitModal/SubmitModal';

type ScanCleanup = () => void;

let scanAndSubmitCleanup: ScanCleanup | null = null;

export function registerScanAndSubmitCleanup(cleanup: ScanCleanup | null): void {
  scanAndSubmitCleanup = cleanup;
}

export function navigateToUploadedMii(miiId: string): void {
  closeSubmitModal();
  scanAndSubmitCleanup?.();
  scanAndSubmitCleanup = null;
  window.location.hash = `#/mii/${encodeURIComponent(miiId)}`;
}
