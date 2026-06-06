const BASE_URL = 'https://mii-unsecure.ariankordi.net';

function normalizeData(data: string): string {
  const trimmed = data.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return trimmed;
  }
  return trimmed;
}

export function buildRenderUrl(
  data: string,
  opts: { type?: string; width?: number } = {},
): string {
  const params = new URLSearchParams();
  params.set('data', normalizeData(data));
  params.set('type', opts.type ?? 'face');
  params.set('width', String(opts.width ?? 256));
  params.set('shaderType', 'switch');
  params.set('bodyType', 'switch');
  return `${BASE_URL}/miis/image.png?${params.toString()}`;
}
