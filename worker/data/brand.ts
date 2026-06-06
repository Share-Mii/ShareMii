export const BRAND_NAME = 'ShareMii.net';

export const DEFAULT_DESCRIPTION =
  'ShareMii.net — community Mii QR code gallery and online Mii Maker for 3DS, Wii U, and Tomodachi Life. Not a Switch save editor.';

/** Tomodachi Life: Living the Dream save import/export tool (different product). */
export const LIVING_THE_DREAM_TOOL_URL = 'https://sharemii.qwkuns.me/';

export const LIVING_THE_DREAM_GITHUB_URL =
  'https://github.com/Star-F0rce/ShareMii';

export function formatBrandTitle(title: string): string {
  if (title.includes(BRAND_NAME)) return title;
  if (title.includes('ShareMii')) {
    return title.replace(/\bShareMii\b/, BRAND_NAME);
  }
  return `${title} · ${BRAND_NAME}`;
}

export function organizationSameAs(
  origin: string,
  env?: { DISCORD_INVITE_URL?: string },
): string[] {
  const links = [origin];
  const discord = env?.DISCORD_INVITE_URL?.trim();
  if (discord) links.push(discord);
  return links;
}
