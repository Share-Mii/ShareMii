const QR_DOWNLOAD_KEY = 'qr-download';

export function hasRecordedQrDownload(miiId: string): boolean {
  try {
    return localStorage.getItem(`${QR_DOWNLOAD_KEY}:${miiId}`) === '1';
  } catch {
    return false;
  }
}

export function markQrDownloadRecorded(miiId: string): void {
  try {
    localStorage.setItem(`${QR_DOWNLOAD_KEY}:${miiId}`, '1');
  } catch {
    /* private mode */
  }
}
