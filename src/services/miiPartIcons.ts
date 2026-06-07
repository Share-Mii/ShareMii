import type { MiiFields } from '@/services/miiEditor';
import { getNestedField } from '@/services/miiEditor';
import {
  eyeColorSwitchToSwatchIndex,
  MII_EYE_SWATCHES,
  MII_FAVORITE_SWATCHES,
  MII_GLASSES_SWATCHES,
  MII_HAIR_SWATCHES,
  MII_MOUTH_LIP_BOTTOM,
  MII_MOUTH_LIP_TOP,
  MII_SKIN_COLOR_DISPLAY_ORDER,
  MII_SKIN_SWATCHES,
} from '@/services/miiColorPalettes';
import { isDarkTheme } from '@/services/theme';

export type MiiIconCategory =
  | 'face'
  | 'makeup'
  | 'wrinkles'
  | 'eyebrows'
  | 'eyes'
  | 'nose'
  | 'mouth'
  | 'mustache'
  | 'goatee'
  | 'hair'
  | 'glasses';

export type MiiIconsData = Record<MiiIconCategory, string[]>;

let iconsPromise: Promise<MiiIconsData> | null = null;

export function loadMiiIcons(): Promise<MiiIconsData> {
  if (!iconsPromise) {
    iconsPromise = import('@/assets/mii-part-icons.json')
      .then((mod) => mod.default as MiiIconsData)
      .catch((err) => {
        iconsPromise = null;
        throw err;
      });
  }
  return iconsPromise;
}

export const PATH_TO_ICON_CATEGORY: Partial<Record<string, MiiIconCategory>> = {
  'face.type': 'face',
  'face.feature': 'wrinkles',
  'face.makeup': 'makeup',
  'hair.type': 'hair',
  'eyes.type': 'eyes',
  'eyebrows.type': 'eyebrows',
  'nose.type': 'nose',
  'mouth.type': 'mouth',
  'glasses.type': 'glasses',
  'beard.type': 'goatee',
  'beard.mustache.type': 'mustache',
};

export const MII_HAIR_DISPLAY_ORDER: Record<number, number> = {
  33: 0, 47: 1, 40: 2, 37: 3, 32: 4, 107: 5, 48: 6, 51: 7, 55: 8, 70: 9, 44: 10, 66: 11,
  52: 12, 50: 13, 38: 14, 49: 15, 43: 16, 31: 17, 56: 18, 68: 19, 62: 20, 115: 21, 76: 22,
  119: 23, 64: 24, 81: 25, 116: 26, 121: 27, 22: 28, 58: 29, 60: 30, 87: 31, 125: 32, 117: 33,
  73: 34, 75: 35, 42: 36, 89: 37, 57: 38, 54: 39, 80: 40, 34: 41, 23: 42, 86: 43, 88: 44,
  118: 45, 39: 46, 36: 47, 45: 48, 67: 49, 59: 50, 65: 51, 41: 52, 30: 53, 12: 54, 16: 55,
  10: 56, 82: 57, 128: 58, 129: 59, 14: 60, 95: 61, 105: 62, 100: 63, 6: 64, 20: 65, 93: 66,
  102: 67, 27: 68, 4: 69, 17: 70, 110: 71, 123: 72, 8: 73, 106: 74, 72: 75, 3: 76, 21: 77,
  0: 78, 98: 79, 63: 80, 90: 81, 11: 82, 120: 83, 5: 84, 74: 85, 108: 86, 94: 87, 124: 88,
  25: 89, 99: 90, 69: 91, 35: 92, 13: 93, 122: 94, 113: 95, 53: 96, 24: 97, 85: 98, 83: 99,
  71: 100, 131: 101, 96: 102, 101: 103, 29: 104, 7: 105, 15: 106, 112: 107, 79: 108, 1: 109,
  109: 110, 127: 111, 91: 112, 26: 113, 61: 114, 103: 115, 2: 116, 77: 117, 18: 118, 92: 119,
  84: 120, 9: 121, 19: 122, 130: 123, 97: 124, 104: 125, 46: 126, 78: 127, 28: 128, 114: 129,
  126: 130, 111: 131,
};

const SKIN_COLORS = MII_SKIN_SWATCHES;
const HAIR_COLORS = MII_HAIR_SWATCHES;
const EYE_COLORS = MII_EYE_SWATCHES;

const MOUTH_LIP: { top: string; bottom: string }[] = MII_MOUTH_LIP_TOP.map(
  (top, i) => ({
    top,
    bottom: MII_MOUTH_LIP_BOTTOM[i] ?? top,
  }),
);

const FAVORITE_TOP = MII_FAVORITE_SWATCHES;

const GLASSES_COLORS = MII_GLASSES_SWATCHES;

/** High-contrast picker icon colors in dark mode (shape preview, not swatch colors). */
const DARK_PICKER_FEATURE = {
  faceDetail: '#ffffff',
  faceStroke: '#c8c8d0',
  faceWrinkles: '#ffffff',
  headStroke: '#c8c8d0',
  eyebrowFill: '#ffffff',
  facialHairFill: '#ffffff',
  eyeColor: '#ffffff',
  lipTop: '#ffffff',
  lipBottom: '#e8e8ee',
  mouthTooth: '#3a3a40',
  glassesFill: '#ffffff',
  glassesShade: '#c8c8d0',
  featureColor: '#ffffff',
} as const;

export function hasPartIcon(path: string): boolean {
  return path in PATH_TO_ICON_CATEGORY;
}

export function getPartIconSvg(
  icons: MiiIconsData,
  path: string,
  partIndex: number,
): string | null {
  const category = PATH_TO_ICON_CATEGORY[path];
  if (!category) return null;
  const list = icons[category];
  if (!list || partIndex < 0 || partIndex >= list.length) return null;
  return list[partIndex] ?? null;
}

function reorderByDisplayTable<T extends { value: number | string | boolean }>(
  options: T[],
  displayOrder: readonly number[],
): T[] {
  const byValue = new Map(options.map((o) => [o.value, o]));
  const ordered: T[] = [];
  for (const value of displayOrder) {
    const opt = byValue.get(value);
    if (opt) ordered.push(opt);
  }
  for (const opt of options) {
    if (!ordered.includes(opt)) ordered.push(opt);
  }
  return ordered;
}

export function reorderOptionsForDisplay<T extends { value: number | string | boolean }>(
  path: string,
  options: T[],
): T[] {
  if (path === 'face.color') {
    return reorderByDisplayTable(options, MII_SKIN_COLOR_DISPLAY_ORDER);
  }
  if (path !== 'hair.type') return options;

  const byValue = new Map(options.map((o) => [o.value, o]));
  const slotToReal = new Map<number, number>();
  for (const [real, slot] of Object.entries(MII_HAIR_DISPLAY_ORDER)) {
    slotToReal.set(slot, Number(real));
  }

  const ordered: T[] = [];
  for (let slot = 0; slot < options.length; slot++) {
    const real = slotToReal.get(slot) ?? slot;
    const opt = byValue.get(real);
    if (opt) ordered.push(opt);
  }

  for (const opt of options) {
    if (!ordered.includes(opt)) ordered.push(opt);
  }

  return ordered;
}

export function applyIconThemeVars(host: HTMLElement, fields: MiiFields): void {
  const dark = isDarkTheme();
  const skin = Number(getNestedField(fields, 'face.color') ?? 0);
  const hair = Number(getNestedField(fields, 'hair.color') ?? 1);
  const eyes = eyeColorSwitchToSwatchIndex(
    Number(getNestedField(fields, 'eyes.color') ?? 8),
  );
  const brows = Number(getNestedField(fields, 'eyebrows.color') ?? hair);
  const beard = Number(getNestedField(fields, 'beard.color') ?? hair);
  const mouth = Number(getNestedField(fields, 'mouth.color') ?? 0);
  const glasses = Number(getNestedField(fields, 'glasses.color') ?? 0);
  const fav = Number(getNestedField(fields, 'general.favoriteColor') ?? 0);

  const skinHex = SKIN_COLORS[skin % SKIN_COLORS.length] ?? '#ffd3ad';
  const lip = MOUTH_LIP[mouth % MOUTH_LIP.length] ?? MOUTH_LIP[0]!;

  host.style.setProperty('--icon-face-fill', skinHex);
  host.style.setProperty('--icon-head-fill', skinHex);
  host.style.setProperty('--icon-hair-fill', HAIR_COLORS[hair % HAIR_COLORS.length] ?? '#402010');
  host.style.setProperty('--icon-hair-tie', FAVORITE_TOP[fav % FAVORITE_TOP.length] ?? '#d21e14');
  host.style.setProperty('--icon-hat-fill', FAVORITE_TOP[fav % FAVORITE_TOP.length] ?? '#d21e14');
  host.style.setProperty('--icon-hat-stroke', dark ? '#c8c8d0' : '#333333');

  if (dark) {
    host.style.setProperty('--icon-face-stroke', DARK_PICKER_FEATURE.faceStroke);
    host.style.setProperty('--icon-face-detail', DARK_PICKER_FEATURE.faceDetail);
    host.style.setProperty('--icon-face-wrinkles', DARK_PICKER_FEATURE.faceWrinkles);
    host.style.setProperty('--icon-head-stroke', DARK_PICKER_FEATURE.headStroke);
    host.style.setProperty('--icon-eyebrow-fill', DARK_PICKER_FEATURE.eyebrowFill);
    host.style.setProperty('--icon-facial-hair-fill', DARK_PICKER_FEATURE.facialHairFill);
    host.style.setProperty('--eye-color', DARK_PICKER_FEATURE.eyeColor);
    host.style.setProperty('--icon-lip-color-top', DARK_PICKER_FEATURE.lipTop);
    host.style.setProperty('--icon-lip-color-bottom', DARK_PICKER_FEATURE.lipBottom);
    host.style.setProperty('--icon-mouth-tooth', DARK_PICKER_FEATURE.mouthTooth);
    host.style.setProperty('--icon-glasses-fill', DARK_PICKER_FEATURE.glassesFill);
    host.style.setProperty('--icon-glasses-shade', DARK_PICKER_FEATURE.glassesShade);
    host.style.color = DARK_PICKER_FEATURE.featureColor;
    return;
  }

  host.style.removeProperty('color');
  host.style.setProperty('--icon-face-stroke', '#6f6f6f');
  host.style.setProperty('--icon-face-detail', '#8d8d8d');
  host.style.setProperty('--icon-face-wrinkles', '#996d54');
  host.style.setProperty('--icon-head-stroke', '#999999');
  host.style.setProperty('--icon-eyebrow-fill', HAIR_COLORS[brows % HAIR_COLORS.length] ?? '#402010');
  host.style.setProperty(
    '--icon-facial-hair-fill',
    HAIR_COLORS[beard % HAIR_COLORS.length] ?? '#402010',
  );
  host.style.setProperty('--eye-color', EYE_COLORS[eyes] ?? '#000000');
  host.style.setProperty('--icon-lip-color-top', lip.top);
  host.style.setProperty('--icon-lip-color-bottom', lip.bottom);
  host.style.setProperty('--icon-mouth-tooth', '#ffffff');
  host.style.setProperty('--icon-glasses-fill', GLASSES_COLORS[glasses % GLASSES_COLORS.length] ?? '#000');
  host.style.setProperty('--icon-glasses-shade', '#606060');
}
