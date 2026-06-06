import {
  decodeMii,
  encodeMii,
  detectMiiFormat,
  scanQR,
  MiiFormats,
} from 'miijs';
import type { DecodedQrMii, Gender, Platform } from '@/types';
import { uint8ToBase64, base64ToUint8 } from '@/services/miiApi';

function bufferToUint8(buf: Uint8Array | ArrayBuffer): Uint8Array {
  if (buf instanceof Uint8Array) return buf;
  return new Uint8Array(buf);
}

const TOMODACHI_FORMATS = new Set([
  'tle',
  'tlec',
  'tls',
  'tlc',
  'tl',
  'tomodachilife',
  'tl_alt',
]);

const RENDER_FORMATS = [MiiFormats.CFSD, MiiFormats.FFSD];

function tryEncode(
  miiObj: Record<string, unknown>,
  formats: unknown[],
): Uint8Array | null {
  for (const format of formats) {
    try {
      return bufferToUint8(
        encodeMii(miiObj, format) as Uint8Array | ArrayBuffer,
      );
    } catch {
      /* try next */
    }
  }
  return null;
}

function isTomodachiPayload(raw: Uint8Array, miiObj: Record<string, unknown>): boolean {
  if (miiObj.tl != null) return true;
  const detected = detectMiiFormat(raw) as string[];
  return detected.some((f) => TOMODACHI_FORMATS.has(f.toLowerCase()));
}

function inferPlatform(
  miiObj: Record<string, unknown>,
  isTomodachi: boolean,
): Platform | undefined {
  if (isTomodachi) return '3ds';
  const meta = miiObj.meta as Record<string, unknown> | undefined;
  const device = meta?.originalDevice ?? meta?.device;
  if (device === 3 || device === '3DS') return '3ds';
  if (device === 4 || device === 'WiiU') return 'wiiu';
  if (device === 1 || device === 'Wii') return 'wii';
  if (device === 5 || device === 'Switch') return 'switch';
  return undefined;
}

function extractName(miiObj: Record<string, unknown>): string | undefined {
  const general = miiObj.general as Record<string, unknown> | undefined;
  const name = general?.name;
  if (typeof name === 'string' && name.trim()) return name.trim();

  const tl = miiObj.tl as Record<string, unknown> | undefined;
  if (tl) {
    const first =
      typeof tl.firstName === 'string' ? tl.firstName.trim() : '';
    const last = typeof tl.lastName === 'string' ? tl.lastName.trim() : '';
    const combined = [first, last].filter(Boolean).join(' ');
    if (combined) return combined;
  }
  return undefined;
}

function extractGender(miiObj: Record<string, unknown>): Gender | undefined {
  const general = miiObj.general as Record<string, unknown> | undefined;
  const g = general?.gender;
  if (g === 0) return 'male';
  if (g === 1) return 'female';
  if (typeof g === 'number') return 'other';
  return undefined;
}

function extractCreator(miiObj: Record<string, unknown>): string | undefined {
  const meta = miiObj.meta as Record<string, unknown> | undefined;
  const creator = meta?.creatorName ?? meta?.author;
  if (typeof creator === 'string' && creator.trim()) return creator.trim();

  const tl = miiObj.tl as Record<string, unknown> | undefined;
  if (tl && typeof tl.island === 'object' && tl.island !== null) {
    const island = tl.island as Record<string, unknown>;
    if (typeof island.name === 'string' && island.name.trim()) {
      return island.name.trim();
    }
  }
  return undefined;
}

export async function normalizeMiiDataForRender(base64: string): Promise<string> {
  const bytes = base64ToUint8(base64);
  
  if (bytes.length <= 120) return base64;

  try {
    const miiObj = (await decodeMii(bytes)) as Record<string, unknown>;
    const renderBytes = tryEncode(miiObj, RENDER_FORMATS);
    if (renderBytes) return uint8ToBase64(renderBytes);
  } catch {
    /* fall through */
  }
  return base64;
}

export function extractQrBytes(code: {
  binaryData?: number[] | Uint8Array;
  data?: string;
}): Uint8Array | null {
  if (code.binaryData?.length) {
    return new Uint8Array(code.binaryData);
  }
  if (code.data) {
    const bytes = new Uint8Array(code.data.length);
    for (let i = 0; i < code.data.length; i++) {
      bytes[i] = code.data.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  return null;
}

export async function scanQrFromImageFile(file: File): Promise<Uint8Array> {
  const scanned = await scanQR(file);
  if (scanned && scanned.length > 0) {
    return bufferToUint8(scanned);
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not load image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return scanQrFromCanvas(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function scanQrFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Could not capture frame'));
    }, 'image/png');
  });

  const scanned = await scanQR(blob);
  if (scanned && scanned.length > 0) {
    return bufferToUint8(scanned);
  }
  throw new Error('No QR code found in frame');
}

export async function decodeQrPayload(binaryData: Uint8Array): Promise<DecodedQrMii> {
  const raw = bufferToUint8(binaryData);

  const miiObj = (await decodeMii(raw)) as Record<string, unknown>;
  const isTomodachi = isTomodachiPayload(raw, miiObj);

  const renderBytes = tryEncode(miiObj, RENDER_FORMATS);
  if (!renderBytes) {
    throw new Error('Could not encode Mii for rendering');
  }

  let downloadBytes: Uint8Array | null = null;
  if (isTomodachi) {
    downloadBytes = tryEncode(miiObj, [MiiFormats.TLS, MiiFormats.FFSD]);
  }

  const download =
    downloadBytes && downloadBytes.length !== renderBytes.length
      ? uint8ToBase64(downloadBytes)
      : undefined;

  return {
    miiDataBase64: uint8ToBase64(renderBytes),
    miiDataDownloadBase64: download,
    name: extractName(miiObj),
    creatorName: extractCreator(miiObj),
    suggestedPlatform: inferPlatform(miiObj, isTomodachi),
    isTomodachiLife: isTomodachi,
    gender: extractGender(miiObj),
  };
}
