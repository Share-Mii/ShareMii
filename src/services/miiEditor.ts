import { decodeMii, encodeMii, MiiFormats } from 'miijs';
import type { DecodedQrMii, Gender, Mii } from '@/types';
import { MII_EYE_COLOR_SWITCH } from '@/services/miiColorPalettes';
import { base64ToUint8, uint8ToBase64 } from '@/services/miiApi';
import { isTomodachiMii } from '@/services/tlClothing';
import { buildRenderUrl } from '@/services/miiApi';

export type MiiFields = Record<string, unknown>;

const RENDER_FORMATS = [MiiFormats.CFSD, MiiFormats.FFSD];

function bufferToUint8(buf: Uint8Array | ArrayBuffer): Uint8Array {
  if (buf instanceof Uint8Array) return buf;
  return new Uint8Array(buf);
}

async function encodeMiiAsync(
  fields: MiiFields,
  format: unknown,
): Promise<Uint8Array> {
  let encoded: Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer> =
    encodeMii(fields, format) as
      | Uint8Array
      | ArrayBuffer
      | Promise<Uint8Array | ArrayBuffer>;

  if (encoded && typeof (encoded as Promise<unknown>).then === 'function') {
    encoded = await encoded;
  }

  return bufferToUint8(encoded as Uint8Array | ArrayBuffer);
}

export function normalizeEyeColorInFields(fields: MiiFields): MiiFields {
  const v = Number(getNestedField(fields, 'eyes.color') ?? 8);
  if (v >= 8 && v <= 13) return fields;
  if (v >= 0 && v < MII_EYE_COLOR_SWITCH.length) {
    return setNestedField(fields, 'eyes.color', MII_EYE_COLOR_SWITCH[v]!);
  }
  return setNestedField(fields, 'eyes.color', 8);
}

export async function encodeFieldsToBase64(
  fields: MiiFields,
): Promise<string> {
  const normalized = normalizeEyeColorInFields(fields);
  for (const format of RENDER_FORMATS) {
    try {
      const bytes = await encodeMiiAsync(normalized, format);
      return uint8ToBase64(bytes);
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not encode Mii');
}

export function getGender(fields: MiiFields): 0 | 1 {
  const general = fields.general as Record<string, unknown> | undefined;
  return general?.gender === 1 ? 1 : 0;
}

export function fieldsToGender(fields: MiiFields): Gender | undefined {
  const g = getGender(fields);
  if (g === 0) return 'male';
  if (g === 1) return 'female';
  return undefined;
}

export function createDefaultMiiFields(gender: 0 | 1 = 0): MiiFields {
  const hairType = gender === 0 ? 0x21 : 0x0c;
  const eyebrowType = gender === 0 ? 6 : 0;
  const eyeType = gender === 0 ? 2 : 4;
  const eyeRotation = gender === 0 ? 4 : 3;

  return {
    general: {
      gender,
      favoriteColor: 0,
      height: 64,
      weight: 64,
      birthMonth: 1,
      birthday: 1,
    },
    miic: {
      birthYear: 1990,
    },
    meta: {
      name: 'Mii',
      originalDevice: 3,
      type: 0,
    },
    perms: {
      mingle: true,
      sharing: true,
      copying: true,
    },
    face: { type: 0, color: 0, feature: 0, makeup: 0 },
    hair: { type: hairType, color: 1, flipped: false },
    eyebrows: {
      type: eyebrowType,
      rotation: 6,
      color: 1,
      size: 4,
      yPosition: 7,
      distanceApart: 2,
      squash: 3,
    },
    eyes: {
      type: eyeType,
      rotation: eyeRotation,
      color: 8,
      size: 4,
      distanceApart: 2,
      squash: 3,
      yPosition: 12,
    },
    nose: { type: 1, size: 4, yPosition: 9 },
    mouth: {
      type: 0x17,
      color: 19,
      size: 4,
      yPosition: 13,
      squash: 3,
    },
    glasses: { type: 0, color: 8, yPosition: 10, size: 4 },
    beard: {
      type: 0,
      color: 8,
      mustache: { type: 0, size: 4, yPosition: 10 },
    },
    mole: { on: false, size: 4, yPosition: 20, xPosition: 2 },
  };
}

export function setNestedField(
  fields: MiiFields,
  path: string,
  value: unknown,
): MiiFields {
  const keys = path.split('.');
  const last = keys.pop()!;
  const root = structuredClone(fields) as MiiFields;
  let cur: Record<string, unknown> = root;
  for (const key of keys) {
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[last] = value;
  return root;
}

export function getNestedField(fields: MiiFields, path: string): unknown {
  const keys = path.split('.');
  let cur: unknown = fields;
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function miiObjectToFields(miiObj: unknown): MiiFields {
  if (
    miiObj &&
    typeof miiObj === 'object' &&
    'toJSON' in miiObj &&
    typeof (miiObj as { toJSON: unknown }).toJSON === 'function'
  ) {
    return (miiObj as { toJSON: () => Record<string, unknown> }).toJSON() as MiiFields;
  }
  return structuredClone(miiObj) as MiiFields;
}

export async function decodeBase64ToFields(
  miiDataBase64: string,
  seed?: { name?: string },
): Promise<MiiFields> {
  const bytes = base64ToUint8(miiDataBase64);
  const miiObj = await decodeMii(bytes);
  let fields = normalizeEyeColorInFields(miiObjectToFields(miiObj));
  if (seed?.name?.trim()) {
    fields = setNestedField(fields, 'meta.name', seed.name.trim());
  }
  return fields;
}

export interface MiiFieldsToDecodedOptions {
  
  existingMii?: Pick<Mii, 'mii_data_download' | 'platform'>;
}

export async function miiFieldsToDecoded(
  fields: MiiFields,
  options: MiiFieldsToDecodedOptions = {},
): Promise<DecodedQrMii> {
  const miiDataBase64 = await encodeFieldsToBase64(fields);
  const meta = fields.meta as Record<string, unknown> | undefined;
  const name =
    typeof meta?.name === 'string' && meta.name.trim()
      ? meta.name.trim()
      : 'Untitled Mii';

  const isTomodachiLife = options.existingMii
    ? isTomodachiMii(options.existingMii)
    : false;

  let miiDataDownloadBase64: string | undefined =
    options.existingMii?.mii_data_download ?? undefined;

  if (isTomodachiLife) {
    try {
      const normalized = normalizeEyeColorInFields(fields);
      const tlsBytes = await encodeMiiAsync(normalized, MiiFormats.TLS);
      miiDataDownloadBase64 = uint8ToBase64(tlsBytes);
    } catch {
      /* keep existing download payload */
    }
  }

  return {
    miiDataBase64,
    miiDataDownloadBase64,
    name,
    suggestedPlatform: options.existingMii?.platform ?? '3ds',
    isTomodachiLife,
    gender: fieldsToGender(fields),
  };
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T & { cancel: () => void };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export type EditorCategoryId =
  | 'general'
  | 'face'
  | 'hair'
  | 'eyes'
  | 'eyebrows'
  | 'nose'
  | 'mouth'
  | 'glasses'
  | 'facialHair';

export interface EditorControl {
  type: 'choice' | 'toggle' | 'slider' | 'text' | 'number';
  label: string;
  path: string;
  options?: { label: string; value: number | string | boolean }[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface EditorCategory {
  id: EditorCategoryId;
  label: string;
  controls: EditorControl[];
}

export const GRID_PAGE_SIZE = 12;

const COLOR_OPTIONS = Array.from({ length: 8 }, (_, i) => ({
  label: String(i + 1),
  value: i,
}));

const EYE_COLOR_OPTIONS = MII_EYE_COLOR_SWITCH.map((value, i) => ({
  label: String(i + 1),
  value,
}));

const FAVORITE_COLORS = [
  'Red',
  'Orange',
  'Yellow',
  'Lime',
  'Green',
  'Blue',
  'Pink',
  'Purple',
  'Brown',
  'White',
  'Black',
  'None',
].map((label, i) => ({ label, value: i }));

function rangeOptions(count: number, start = 0): { label: string; value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    label: String(start + i),
    value: start + i,
  }));
}

function featureSliders(
  prefix: string,
  opts: {
    size?: boolean;
    height?: { max: number };
    spacing?: boolean;
    stretch?: boolean;
    tilt?: boolean;
  },
): EditorControl[] {
  const controls: EditorControl[] = [];
  if (opts.size) {
    controls.push({
      type: 'slider',
      label: 'Size',
      path: `${prefix}.size`,
      min: 0,
      max: 7,
    });
  }
  if (opts.height) {
    controls.push({
      type: 'slider',
      label: 'Height',
      path: `${prefix}.yPosition`,
      min: 0,
      max: opts.height.max,
    });
  }
  if (opts.spacing) {
    controls.push({
      type: 'slider',
      label: 'Spacing',
      path: `${prefix}.distanceApart`,
      min: 0,
      max: 7,
    });
  }
  if (opts.stretch) {
    controls.push({
      type: 'slider',
      label: 'Stretch',
      path: `${prefix}.squash`,
      min: 0,
      max: 7,
    });
  }
  if (opts.tilt) {
    controls.push({
      type: 'slider',
      label: 'Tilt',
      path: `${prefix}.rotation`,
      min: 0,
      max: 7,
    });
  }
  return controls;
}

const FEATURE_CATEGORIES: EditorCategory[] = [
  {
    id: 'face',
    label: 'Face',
    controls: [
      {
        type: 'choice',
        label: 'Face shape',
        path: 'face.type',
        options: rangeOptions(12),
      },
      {
        type: 'choice',
        label: 'Wrinkles',
        path: 'face.feature',
        options: rangeOptions(12),
      },
      {
        type: 'choice',
        label: 'Makeup',
        path: 'face.makeup',
        options: rangeOptions(12),
      },
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    controls: [
      {
        type: 'choice',
        label: 'Hairstyle',
        path: 'hair.type',
        options: rangeOptions(132),
      },
      {
        type: 'choice',
        label: 'Hair color',
        path: 'hair.color',
        options: COLOR_OPTIONS,
      },
      {
        type: 'toggle',
        label: 'Flip hair',
        path: 'hair.flipped',
        options: [
          { label: 'Left', value: false },
          { label: 'Right', value: true },
        ],
      },
    ],
  },
  {
    id: 'eyes',
    label: 'Eyes',
    controls: [
      {
        type: 'choice',
        label: 'Eye shape',
        path: 'eyes.type',
        options: rangeOptions(56),
      },
      {
        type: 'choice',
        label: 'Eye color',
        path: 'eyes.color',
        options: EYE_COLOR_OPTIONS,
      },
      ...featureSliders('eyes', {
        size: true,
        height: { max: 24 },
        spacing: true,
        stretch: true,
        tilt: true,
      }),
    ],
  },
  {
    id: 'eyebrows',
    label: 'Eyebrows',
    controls: [
      {
        type: 'choice',
        label: 'Eyebrow shape',
        path: 'eyebrows.type',
        options: rangeOptions(24),
      },
      {
        type: 'choice',
        label: 'Eyebrow color',
        path: 'eyebrows.color',
        options: COLOR_OPTIONS,
      },
      ...featureSliders('eyebrows', {
        size: true,
        height: { max: 18 },
        spacing: true,
        stretch: true,
        tilt: true,
      }),
    ],
  },
  {
    id: 'nose',
    label: 'Nose',
    controls: [
      {
        type: 'choice',
        label: 'Nose shape',
        path: 'nose.type',
        options: rangeOptions(18),
      },
      ...featureSliders('nose', {
        size: true,
        height: { max: 18 },
      }),
    ],
  },
  {
    id: 'mouth',
    label: 'Mouth',
    controls: [
      {
        type: 'choice',
        label: 'Mouth shape',
        path: 'mouth.type',
        options: rangeOptions(36),
      },
      {
        type: 'choice',
        label: 'Lip color',
        path: 'mouth.color',
        options: rangeOptions(24),
      },
      ...featureSliders('mouth', {
        size: true,
        height: { max: 18 },
        stretch: true,
      }),
    ],
  },
  {
    id: 'glasses',
    label: 'Glasses',
    controls: [
      {
        type: 'choice',
        label: 'Glasses',
        path: 'glasses.type',
        options: rangeOptions(10),
      },
      {
        type: 'choice',
        label: 'Frame color',
        path: 'glasses.color',
        options: COLOR_OPTIONS,
      },
      ...featureSliders('glasses', {
        size: true,
        height: { max: 18 },
      }),
    ],
  },
  {
    id: 'facialHair',
    label: 'Facial hair',
    controls: [
      {
        type: 'choice',
        label: 'Facial hair',
        path: 'beard.type',
        options: rangeOptions(6),
      },
      {
        type: 'choice',
        label: 'Mustache',
        path: 'beard.mustache.type',
        options: rangeOptions(6),
      },
      {
        type: 'choice',
        label: 'Hair color',
        path: 'beard.color',
        options: COLOR_OPTIONS,
      },
    ],
  },
];

export const GENERAL_CATEGORY: EditorCategory = {
  id: 'general',
  label: 'General',
  controls: [
    {
      type: 'toggle',
      label: 'Gender',
      path: 'general.gender',
      options: [
        { label: 'Male', value: 0 },
        { label: 'Female', value: 1 },
      ],
    },
    {
      type: 'choice',
      label: 'Favorite color',
      path: 'general.favoriteColor',
      options: FAVORITE_COLORS,
    },
    {
      type: 'slider',
      label: 'Height',
      path: 'general.height',
      min: 0,
      max: 127,
    },
    {
      type: 'slider',
      label: 'Build',
      path: 'general.weight',
      min: 0,
      max: 127,
    },
    {
      type: 'number',
      label: 'Month',
      path: 'general.birthMonth',
      min: 1,
      max: 12,
      placeholder: 'MM',
    },
    {
      type: 'number',
      label: 'Day',
      path: 'general.birthday',
      min: 1,
      max: 31,
      placeholder: 'DD',
    },
    {
      type: 'number',
      label: 'Year',
      path: 'miic.birthYear',
      min: 1900,
      max: 9999,
      placeholder: 'YYYY',
    },
  ],
};

export const EDITOR_CATEGORIES: EditorCategory[] = [
  ...FEATURE_CATEGORIES,
  GENERAL_CATEGORY,
];

const RANDOM_PATHS: { path: string; max: number }[] = [
  { path: 'face.type', max: 11 },
  { path: 'face.color', max: 9 },
  { path: 'hair.type', max: 131 },
  { path: 'hair.color', max: 7 },
  { path: 'eyes.type', max: 55 },
  { path: 'eyes.color', max: 5 },
  { path: 'eyebrows.type', max: 23 },
  { path: 'nose.type', max: 17 },
  { path: 'mouth.type', max: 35 },
  { path: 'glasses.type', max: 9 },
  { path: 'beard.type', max: 5 },
];

export function randomizeMiiFields(fields: MiiFields): MiiFields {
  let next = structuredClone(fields) as MiiFields;
  for (const { path, max } of RANDOM_PATHS) {
    if (path === 'eyes.color') {
      const pick =
        MII_EYE_COLOR_SWITCH[
          Math.floor(Math.random() * MII_EYE_COLOR_SWITCH.length)
        ]!;
      next = setNestedField(next, path, pick);
      continue;
    }
    next = setNestedField(next, path, Math.floor(Math.random() * (max + 1)));
  }
  next = setNestedField(
    next,
    'general.favoriteColor',
    Math.floor(Math.random() * 12),
  );
  return next;
}

export function applyGenderDefaults(
  fields: MiiFields,
  gender: 0 | 1,
): MiiFields {
  const defaults = createDefaultMiiFields(gender);
  let next = setNestedField(fields, 'general.gender', gender);
  next = setNestedField(next, 'hair.type', getNestedField(defaults, 'hair.type'));
  next = setNestedField(
    next,
    'eyebrows.type',
    getNestedField(defaults, 'eyebrows.type'),
  );
  next = setNestedField(next, 'eyes.type', getNestedField(defaults, 'eyes.type'));
  next = setNestedField(
    next,
    'eyes.rotation',
    getNestedField(defaults, 'eyes.rotation'),
  );
  return next;
}

export class MiiUndoStack {
  private stack: MiiFields[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  push(fields: MiiFields): void {
    this.stack.push(structuredClone(fields) as MiiFields);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  }

  pop(_current: MiiFields): MiiFields | null {
    if (this.stack.length === 0) return null;
    const prev = this.stack.pop()!;
    return prev;
  }

  canUndo(): boolean {
    return this.stack.length > 0;
  }

  clear(): void {
    this.stack.length = 0;
  }
}

const thumbnailCache = new Map<string, string>();

export function thumbnailCacheKey(
  base64: string,
  categoryId: string,
  optionValue: number,
): string {
  return `${base64.slice(0, 24)}:${categoryId}:${optionValue}`;
}

export async function fetchOptionThumbnail(
  baseFields: MiiFields,
  path: string,
  value: number,
  categoryId: string,
): Promise<string> {
  const patched = setNestedField(baseFields, path, value);
  const base64 = await encodeFieldsToBase64(patched);
  const key = thumbnailCacheKey(base64, categoryId, value);
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const url = buildRenderUrl(base64, {
    width: 72,
    type: 'face',
  });

  thumbnailCache.set(key, url);
  return url;
}

export const MII_MAKER_V2_NOTE =
  'Full 3D preview (FFL.js) is planned as a follow-up; v1 uses the render API.';
