
export const PASTEL_COLORS = [
  '#f9d0d0', // soft pink
  '#d8d0f0', // lavender
  '#f5ecc5', // pale yellow
  '#c5e8d0', // mint green
  '#c5dff5', // sky blue
  '#f5d8c0', // peach
] as const;

export const PASTEL_COLORS_DARK = [
  '#5c4548',
  '#454358',
  '#565042',
  '#3d5248',
  '#3d4f5c',
  '#5c4e42',
] as const;

export const PASTEL_CSS_VARS = [
  '--pastel-pink',
  '--pastel-lavender',
  '--pastel-yellow',
  '--pastel-mint',
  '--pastel-sky',
  '--pastel-peach',
] as const;

export type PastelColor = (typeof PASTEL_COLORS)[number];

export function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function activePastels(): readonly string[] {
  return document.documentElement.dataset.theme === 'dark'
    ? PASTEL_COLORS_DARK
    : PASTEL_COLORS;
}

export function pastelByIndex(index: number): string {
  const palette = activePastels();
  return palette[((index % palette.length) + palette.length) % palette.length]!;
}

export function pastelFromId(id: string, offset = 0): string {
  return pastelByIndex(hashId(id) + offset);
}

export function pastelCssVarByIndex(index: number): string {
  const v =
    PASTEL_CSS_VARS[
      ((index % PASTEL_CSS_VARS.length) + PASTEL_CSS_VARS.length) %
        PASTEL_CSS_VARS.length
    ]!;
  return `var(${v})`;
}

export function pastelCssVarFromId(id: string, offset = 0): string {
  return pastelCssVarByIndex(hashId(id) + offset);
}
