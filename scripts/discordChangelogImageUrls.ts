/**
 * Discord changelog embed images — source of truth in git.
 */

export type DiscordChangelogImageUrlsCommitted = {
  headerImageUrl: string;
  mainEmbedImageUrl: string;
  footerImageUrl: string;
  omitTextOnMainImageEmbed?: boolean;
};

export const DISCORD_CHANGELOG_IMAGE_URLS_COMMITTED: DiscordChangelogImageUrlsCommitted =
  {
    headerImageUrl: 'https://i.imgur.com/8Uip5J0.png',
    mainEmbedImageUrl: 'https://i.imgur.com/1gR9rPY.png',
    footerImageUrl: '',
  };

export function trimImageUrl(committed: string): string | undefined {
  const t = committed.trim();
  return t.length > 0 ? t : undefined;
}
