const BASE_URL = 'https://mii-unsecure.ariankordi.net';

export const DEFAULT_BODY_TYPE = 'switch';

export const DEFAULT_SHADER_TYPE = 'switch';

export interface RenderOptions {
  type?: string;
  width?: number;
  expression?: string;
  
  characterYRotate?: number;
  characterXRotate?: number;
  characterZRotate?: number;
  
  cameraXRotate?: number;
  cameraYRotate?: number;
  cameraZRotate?: number;
  
  shaderType?: string;
  
  bodyType?: string;
}

function normalizeData(data: string): string {
  const trimmed = data.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return trimmed;
  }
  return trimmed;
}

export function buildRenderUrl(data: string, opts: RenderOptions = {}): string {
  const bodyType = opts.bodyType ?? DEFAULT_BODY_TYPE;
  const shaderType = opts.shaderType ?? bodyType;
  const params = new URLSearchParams();
  params.set('data', normalizeData(data));
  params.set('type', opts.type ?? 'face');
  params.set('width', String(opts.width ?? 256));
  params.set('shaderType', shaderType);
  params.set('bodyType', bodyType);
  if (opts.expression) {
    params.set('expression', opts.expression);
  }
  if (opts.characterYRotate !== undefined) {
    params.set('characterYRotate', String(opts.characterYRotate));
  }
  if (opts.characterXRotate !== undefined) {
    params.set('characterXRotate', String(opts.characterXRotate));
  }
  if (opts.characterZRotate !== undefined) {
    params.set('characterZRotate', String(opts.characterZRotate));
  }
  if (opts.cameraXRotate !== undefined) {
    params.set('cameraXRotate', String(opts.cameraXRotate));
  }
  if (opts.cameraYRotate !== undefined) {
    params.set('cameraYRotate', String(opts.cameraYRotate));
  }
  if (opts.cameraZRotate !== undefined) {
    params.set('cameraZRotate', String(opts.cameraZRotate));
  }
  return `${BASE_URL}/miis/image.png?${params.toString()}`;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
