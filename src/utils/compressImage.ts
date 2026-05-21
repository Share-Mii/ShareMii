const WEBP_QUALITY = 0.88;
const JPEG_QUALITY = 0.9;

const AVATAR_SIZE = 512;
const BANNER_MAX_WIDTH = 1920;
const BANNER_MAX_HEIGHT = 600;

export const PROFILE_IMAGE_SOURCE_MAX_BYTES = 12 * 1024 * 1024;

export type ProfileImageCompressKind = 'avatar' | 'banner';

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not read image.');
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function coverCropRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  if (srcAspect > dstAspect) {
    const sh = srcH;
    const sw = srcH * dstAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh };
  }

  const sw = srcW;
  const sh = srcW / dstAspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw, sh };
}

function fitInside(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (srcW <= maxW && srcH <= maxH) {
    return { width: srcW, height: srcH };
  }
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

function fileFromBlob(
  blob: Blob,
  baseName: string,
  ext: string,
  mime: string,
): File {
  const stem = baseName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${stem}.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  });
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  baseName: string,
  maxBytes: number,
): Promise<File> {
  const attempts: Array<{
    mime: 'image/webp' | 'image/jpeg';
    ext: string;
    quality: number;
  }> = [
    { mime: 'image/webp', ext: 'webp', quality: WEBP_QUALITY },
    { mime: 'image/webp', ext: 'webp', quality: 0.78 },
    { mime: 'image/webp', ext: 'webp', quality: 0.68 },
    { mime: 'image/webp', ext: 'webp', quality: 0.58 },
    { mime: 'image/jpeg', ext: 'jpg', quality: JPEG_QUALITY },
    { mime: 'image/jpeg', ext: 'jpg', quality: 0.72 },
    { mime: 'image/jpeg', ext: 'jpg', quality: 0.58 },
  ];

  let smallest: { blob: Blob; ext: string; mime: string } | null = null;

  for (const { mime, ext, quality } of attempts) {
    const blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) continue;
    if (blob.size <= maxBytes) {
      return fileFromBlob(blob, baseName, ext, mime);
    }
    if (!smallest || blob.size < smallest.blob.size) {
      smallest = { blob, ext, mime };
    }
  }

  if (smallest) {
    return fileFromBlob(smallest.blob, baseName, smallest.ext, smallest.mime);
  }

  throw new Error('Could not compress image.');
}

export async function compressProfileImage(
  file: File,
  kind: ProfileImageCompressKind,
  maxBytes: number,
): Promise<File> {
  const bitmap = await loadBitmap(file);

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not compress image.');

    if (kind === 'avatar') {
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const { sx, sy, sw, sh } = coverCropRect(
        bitmap.width,
        bitmap.height,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
      ctx.drawImage(
        bitmap,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
    } else {
      const { width, height } = fitInside(
        bitmap.width,
        bitmap.height,
        BANNER_MAX_WIDTH,
        BANNER_MAX_HEIGHT,
      );
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(bitmap, 0, 0, width, height);
    }

    return await encodeCanvas(canvas, file.name, maxBytes);
  } finally {
    bitmap.close();
  }
}
