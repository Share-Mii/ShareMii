import jsQR from 'jsqr';
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

/** Max edge lengths to try for uploads — downscaling ~700px often fixes screen-photo moiré. */
const UPLOAD_SCAN_MAX_DIMS = [1600, 700, 640, 512] as const;
/** Give up if a single upload decode pass runs longer than this (miijs can stall on bad photos). */
const UPLOAD_SCAN_TIMEOUT_MS = 20_000;
/** Screen-photo QR crops above this size usually fail until downscaled. */
const DIRECT_SCAN_MAX_DIM = 800;

function fitImageDimensions(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { width, height };
  const scale = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function loadImageFromObjectUrl(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load image'));
    el.src = url;
  });
}

function drawImageRegionToCanvas(
  img: HTMLImageElement,
  maxDim: number,
  sx = 0,
  sy = 0,
  sw = img.naturalWidth,
  sh = img.naturalHeight,
): HTMLCanvasElement {
  const { width, height } = fitImageDimensions(sw, sh, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d')!.drawImage(source, 0, 0);
  return canvas;
}

/** Light blur helps photos of screens where moiré breaks QR edge detection. */
function softenCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'blur(1.5px)';
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';
  return canvas;
}

function uploadScanMaxDims(longest: number): number[] {
  const dims: number[] = [];
  if (longest <= 700) {
    dims.push(longest);
  }
  for (const dim of UPLOAD_SCAN_MAX_DIMS) {
    const scaled = Math.min(longest, dim);
    // Full-resolution screen photos almost never decode — only try smaller scales.
    if (scaled >= 200 && scaled < longest && !dims.includes(scaled)) {
      dims.push(scaled);
    }
  }
  // Large screen photos: moiré clears up around 700px — try smaller scales first.
  if (longest > 700) {
    dims.sort((a, b) => a - b);
  } else {
    dims.sort((a, b) => b - a);
  }
  return dims;
}

function uploadScanCandidates(img: HTMLImageElement): HTMLCanvasElement[] {
  const seen = new Set<string>();
  const out: HTMLCanvasElement[] = [];
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const longest = Math.max(natW, natH);

  const add = (canvas: HTMLCanvasElement): void => {
    const key = `${canvas.width}x${canvas.height}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(canvas);

    const soft = softenCanvas(canvas);
    const softKey = `${soft.width}x${soft.height}:soft`;
    if (!seen.has(softKey)) {
      seen.add(softKey);
      out.push(soft);
    }
  };

  for (const maxDim of uploadScanMaxDims(longest)) {
    add(drawImageRegionToCanvas(img, maxDim));

    if (natW / natH >= 1.15) {
      for (const startX of [0.5, 0.55, 0.58]) {
        const sx = Math.round(natW * startX);
        const sw = natW - sx;
        if (sw < 80) continue;
        add(drawImageRegionToCanvas(img, maxDim, sx, 0, sw, natH));
      }
    }
  }

  return out;
}

function clampByte(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n | 0;
}

function toGrayscaleContrast(
  rgba: Uint8ClampedArray,
  contrast = 1,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
    const adjusted = clampByte((lum - 128) * contrast + 128);
    out[i] = adjusted;
    out[i + 1] = adjusted;
    out[i + 2] = adjusted;
    out[i + 3] = 255;
  }
  return out;
}

function toBinaryThreshold(
  rgba: Uint8ClampedArray,
  threshold = 128,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
    const value = lum < threshold ? 0 : 255;
    out[i] = value;
    out[i + 1] = value;
    out[i + 2] = value;
    out[i + 3] = 255;
  }
  return out;
}

function resizeNearestRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
): { width: number; height: number; rgba: Uint8ClampedArray } {
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  if (outWidth === width && outHeight === height) {
    return { width, height, rgba };
  }

  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < outWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / scale));
      const srcI = (srcY * width + srcX) * 4;
      const outI = (y * outWidth + x) * 4;
      out[outI] = rgba[srcI]!;
      out[outI + 1] = rgba[srcI + 1]!;
      out[outI + 2] = rgba[srcI + 2]!;
      out[outI + 3] = rgba[srcI + 3]!;
    }
  }

  return { width: outWidth, height: outHeight, rgba: out };
}

type RgbaFrame = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

/**
 * miijs scanQR upscales sub-700px frames back to full size, which breaks screen-photo
 * QR crops we intentionally downscaled. Run jsQR variants on canvas pixels directly instead.
 */
function decodeWithJsQrVariants(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  allowUpscale: boolean,
): Uint8Array | null {
  const variants: RgbaFrame[] = [
    { width, height, rgba },
    { width, height, rgba: toGrayscaleContrast(rgba, 1.4) },
    { width, height, rgba: toGrayscaleContrast(rgba, 1.9) },
  ];

  for (const threshold of [112, 128, 144]) {
    variants.push({ width, height, rgba: toBinaryThreshold(rgba, threshold) });
  }

  if (allowUpscale && width * height <= 700 * 700) {
    const upscaled = resizeNearestRgba(rgba, width, height, 2);
    variants.push(upscaled);
    variants.push({
      width: upscaled.width,
      height: upscaled.height,
      rgba: toGrayscaleContrast(upscaled.rgba, 1.4),
    });
    variants.push({
      width: upscaled.width,
      height: upscaled.height,
      rgba: toBinaryThreshold(upscaled.rgba, 128),
    });
  }

  const decodeOptions = [
    { inversionAttempts: 'attemptBoth' as const },
    { inversionAttempts: 'dontInvert' as const },
  ];

  for (const variant of variants) {
    for (const opts of decodeOptions) {
      try {
        const decoded = jsQR(
          variant.rgba,
          variant.width,
          variant.height,
          opts,
        );
        const bytes = extractQrBytes(decoded ?? {});
        if (bytes?.length) return bytes;
      } catch {
        continue;
      }
    }
  }

  return null;
}

function scanCanvasForQr(
  canvas: HTMLCanvasElement,
  allowUpscale: boolean,
): Uint8Array | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeWithJsQrVariants(data, width, height, allowUpscale);
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function scanUploadCanvas(
  canvas: HTMLCanvasElement,
): Promise<Uint8Array | null> {
  return scanCanvasForQr(canvas, false);
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

export type QrImageScanResult = {
  bytes: Uint8Array;
  /** Scaled canvas used for decode — handy for enhanced retries without the live camera. */
  canvas: HTMLCanvasElement;
};

export async function scanQrFromImageFile(
  file: File,
): Promise<QrImageScanResult> {
  return withTimeout(
    (async () => {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImageFromObjectUrl(url);
        const longest = longestUploadDim(img);

        // Wide Tomodachi cards decode from the original JPEG; square screen photos do not.
        const isWideCard = img.naturalWidth / img.naturalHeight >= 1.15;
        if (longest <= DIRECT_SCAN_MAX_DIM || isWideCard) {
          const direct = await scanQR(file);
          if (direct && direct.length > 0) {
            return {
              bytes: bufferToUint8(direct),
              canvas: drawImageRegionToCanvas(img, longest),
            };
          }
        }

        for (const candidate of uploadScanCandidates(img)) {
          await yieldToMainThread();
          const bytes = await scanUploadCanvas(candidate);
          if (bytes?.length) {
            return { bytes, canvas: cloneCanvas(candidate) };
          }
        }
        throw new Error('No QR code found in image');
      } finally {
        URL.revokeObjectURL(url);
      }
    })(),
    UPLOAD_SCAN_TIMEOUT_MS,
    'QR image scan',
  );
}

function longestUploadDim(img: HTMLImageElement): number {
  return Math.max(img.naturalWidth, img.naturalHeight);
}

export async function scanQrFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<Uint8Array> {
  const direct = scanCanvasForQr(canvas, true);
  if (direct?.length) return direct;

  const longest = Math.max(canvas.width, canvas.height);
  for (const maxDim of UPLOAD_SCAN_MAX_DIMS) {
    if (maxDim >= longest) continue;
    const { width, height } = fitImageDimensions(canvas.width, canvas.height, maxDim);
    const scaled = document.createElement('canvas');
    scaled.width = width;
    scaled.height = height;
    scaled.getContext('2d')!.drawImage(canvas, 0, 0, width, height);
    const scaledBytes = scanCanvasForQr(scaled, false);
    if (scaledBytes?.length) return scaledBytes;
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
