

export const MII_FAVORITE_SWATCHES: readonly string[] = [
  '#d21e14',
  '#ff6e19',
  '#ffd820',
  '#78d220',
  '#007830',
  '#0a48bc',
  '#3caade',
  '#f55a7d',
  '#7328ad',
  '#483818',
  '#e0e0e0',
  '#181814',
] as const;

export const MII_SKIN_SWATCHES: readonly string[] = [
  '#FFD3AD',
  '#FEB66B',
  '#DE7942',
  '#FFAA8C',
  '#AD5129',
  '#632C18',
  '#ffbea5',
  '#ffc58f',
  '#8c3c23',
  '#3c2d23',
] as const;

export const MII_HAIR_SWATCHES: readonly string[] = [
  '#000000',
  '#402010',
  '#5C180A',
  '#7C3A14',
  '#787880',
  '#4E3E11',
  '#875917',
  '#D0A049',
] as const;

export const MII_EYE_SWATCHES: readonly string[] = [
  '#000000',
  '#717372',
  '#663C2C',
  '#686537',
  '#4B58A8',
  '#387059',
] as const;

export const MII_EYE_COLOR_SWITCH: readonly number[] = [8, 9, 10, 11, 12, 13] as const;

const EYE_SWITCH_TO_SWATCH = new Map(
  MII_EYE_COLOR_SWITCH.map((switchIdx, uiIdx) => [switchIdx, uiIdx]),
);

export function eyeColorSwitchToSwatchIndex(switchColor: number): number {
  return EYE_SWITCH_TO_SWATCH.get(switchColor) ?? 0;
}

export const MII_GLASSES_SWATCHES: readonly string[] = [
  '#000000',
  '#5d391a',
  '#a01612',
  '#2e3969',
  '#a4601e',
  '#766f67',
] as const;

export const MII_MOUTH_SWATCHES: readonly string[] = [
  '#171414',
  '#201008',
  '#2e0c05',
  '#4a230c',
  '#54545a',
  '#271f08',
  '#52350e',
  '#b18028',
  '#000000',
  '#4c4e4e',
  '#331e16',
  '#3a381d',
  '#2a3265',
  '#274e3e',
  '#301c08',
  '#650a05',
  '#101834',
  '#764300',
  '#544e49',
  '#823018',
  '#780c0c',
  '#882028',
  '#dc7850',
  '#461e0a',
  '#4f1717',
] as const;

export const MII_MOUTH_LIP_TOP: readonly string[] = [
  '#823018',
  '#780C0D',
  '#882028',
  '#DC7751',
  '#461E0A',
] as const;

export const MII_MOUTH_LIP_BOTTOM: readonly string[] = [
  '#D85209',
  '#F00C09',
  '#F54849',
  '#F09A74',
  '#8C503F',
] as const;

const FALLBACK = '#9e9e9e';

export function getMiiSwatchColor(path: string, index: number): string {
  if (path.includes('favoriteColor')) {
    return MII_FAVORITE_SWATCHES[index] ?? FALLBACK;
  }
  if (path === 'face.color') {
    return MII_SKIN_SWATCHES[index] ?? FALLBACK;
  }
  if (path === 'mouth.color') {
    return MII_MOUTH_SWATCHES[index] ?? FALLBACK;
  }
  if (path === 'eyes.color') {
    const swatch =
      index < MII_EYE_SWATCHES.length
        ? index
        : eyeColorSwitchToSwatchIndex(index);
    return MII_EYE_SWATCHES[swatch] ?? FALLBACK;
  }
  if (path === 'glasses.color') {
    return MII_GLASSES_SWATCHES[index % MII_GLASSES_SWATCHES.length] ?? FALLBACK;
  }
  if (path.includes('.color')) {
    return MII_HAIR_SWATCHES[index % MII_HAIR_SWATCHES.length] ?? FALLBACK;
  }
  return FALLBACK;
}
