import { decodeMii, encodeMii, makeQR, MiiFormats } from 'miijs';
import { base64ToUint8 } from '@/services/miiApi';
import type { DecodedQrMii, Mii, Platform } from '@/types';

interface QrMiiSource {
  name: string;
  mii_data: string;
  mii_data_download?: string | null;
  platform?: Platform;
}

function bufferToUint8(buf: Uint8Array | ArrayBuffer): Uint8Array {
  if (buf instanceof Uint8Array) return buf;
  return new Uint8Array(buf);
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Promise<T>).then === 'function'
  );
}

async function encodeMiiAsync(
  miiObj: unknown,
  format: unknown,
): Promise<Uint8Array> {
  let encoded: Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer> =
    encodeMii(miiObj, format) as
      | Uint8Array
      | ArrayBuffer
      | Promise<Uint8Array | ArrayBuffer>;

  if (isPromise(encoded)) {
    encoded = await encoded;
  }

  return bufferToUint8(encoded);
}

function qrFormatsForSource(source: QrMiiSource): unknown[] {
  if (source.mii_data_download) {
    return [MiiFormats.TLE, MiiFormats.TLS];
  }
  if (source.platform === 'wiiu') {
    return [MiiFormats.FFED];
  }
  return [MiiFormats.CFED];
}

async function encodeForQr(
  miiObj: unknown,
  source: QrMiiSource,
): Promise<Uint8Array> {
  const formats = qrFormatsForSource(source);
  let lastError: unknown;

  for (const format of formats) {
    try {
      return await encodeMiiAsync(miiObj, format);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not encode Mii for QR');
}

async function generateQrPngFromSource(source: QrMiiSource): Promise<Blob> {
  const bytes = base64ToUint8(source.mii_data);
  const miiObj = await decodeMii(bytes);
  const qrBytes = await encodeForQr(miiObj, source);

  let pngResult: Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer> =
    makeQR(qrBytes, {
      size: 512,
      label: source.name,
      noRenderMii: true,
    }) as Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer>;

  if (isPromise(pngResult)) {
    pngResult = await pngResult;
  }

  const pngBytes = bufferToUint8(pngResult);
  return new Blob([new Uint8Array(pngBytes)], { type: 'image/png' });
}

export async function generateQrPngFromDecoded(
  decoded: DecodedQrMii,
  platform?: Platform,
): Promise<Blob> {
  const resolvedPlatform = platform ?? decoded.suggestedPlatform ?? '3ds';
  return generateQrPngFromSource({
    name: decoded.name ?? 'Mii',
    mii_data: decoded.miiDataBase64,
    mii_data_download: decoded.miiDataDownloadBase64 ?? null,
    platform: resolvedPlatform,
  });
}

export function qrDeviceLabelForDecoded(
  decoded: DecodedQrMii,
  platform?: Platform,
): string {
  if (decoded.isTomodachiLife || decoded.miiDataDownloadBase64) {
    return 'Tomodachi Life';
  }
  const p = platform ?? decoded.suggestedPlatform;
  if (p === 'wiiu') return 'Wii U';
  if (p === '3ds') return 'Nintendo 3DS';
  return 'Nintendo 3DS / Wii U';
}

export async function generateMiiQrPng(mii: Mii): Promise<Blob> {
  const sourceB64 = mii.mii_data || mii.mii_data_download;
  if (!sourceB64) {
    throw new Error('Mii has no data to encode');
  }
  return generateQrPngFromSource({
    name: mii.name,
    mii_data: sourceB64,
    mii_data_download: mii.mii_data_download,
    platform: mii.platform,
  });
}

export function qrDeviceLabel(mii: Mii): string {
  if (mii.mii_data_download) return 'Tomodachi Life';
  if (mii.platform === 'wiiu') return 'Wii U';
  if (mii.platform === '3ds') return 'Nintendo 3DS';
  return 'Nintendo 3DS / Wii U';
}

export function platformForQr(mii: Mii): Platform {
  return mii.platform;
}
