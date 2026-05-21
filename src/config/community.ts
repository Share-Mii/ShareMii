/** Public community links (set in .env.local / GitHub Actions secrets). */
export function getDiscordInviteUrl(): string | null {
  const url = import.meta.env.VITE_DISCORD_INVITE_URL?.trim();
  return url || null;
}
