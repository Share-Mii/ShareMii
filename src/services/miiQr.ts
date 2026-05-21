import { decodeMii, encodeMii, makeQR, MiiFormats } from 'miijs';
import { base64ToUint8 } from '@/services/miiApi';
import type { Mii, Platform } from '@/types';

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

function qrFormatsForMii(mii: Mii): unknown[] {
  if (mii.mii_data_download) {
    return [MiiFormats.TLE, MiiFormats.TLS];
  }
  if (mii.platform === 'wiiu') {
    return [MiiFormats.FFED];
  }
  return [MiiFormats.CFED];
}

async function encodeForQr(
  miiObj: unknown,
  mii: Mii,
): Promise<Uint8Array> {
  const formats = qrFormatsForMii(mii);
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

export async function generateMiiQrPng(mii: Mii): Promise<Blob> {
  const sourceB64 = mii.mii_data || mii.mii_data_download;
  if (!sourceB64) {
    throw new Error('Mii has no data to encode');
  }

  const bytes = base64ToUint8(sourceB64);
  const miiObj = await decodeMii(bytes);
  const qrBytes = await encodeForQr(miiObj, mii);

  let pngResult: Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer> =
    makeQR(qrBytes, {
      size: 512,
      label: mii.name,
      noRenderMii: true,
    }) as Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer>;

  if (isPromise(pngResult)) {
    pngResult = await pngResult;
  }

  const pngBytes = bufferToUint8(pngResult);
  return new Blob([new Uint8Array(pngBytes)], { type: 'image/png' });
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
