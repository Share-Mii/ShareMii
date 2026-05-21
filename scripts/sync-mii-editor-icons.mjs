#!/usr/bin/env node
/**
 * Pull tab/control SVGs from mii-creator (Mii MX) EditorIcons.ts into src/assets.
 * @see https://github.com/datkat21/mii-creator/blob/dev/src/constants/EditorIcons.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/datkat21/mii-creator/dev/src/constants/EditorIcons.ts';

const KEYS = [
  'eyes',
  'eyebrows',
  'nose',
  'mouth',
  'glasses',
  'mole',
  'head',
  'hair',
  'facialHair',
  'face',
  'face_makeup',
  'face_wrinkles',
  'scale',
  'favoriteColor',
  'gender',
  'details',
  'positionMoveDown',
  'positionMoveUp',
  'positionPushIn',
  'positionPushOut',
  'positionRotateCW',
  'positionRotateCCW',
  'positionSizeDown',
  'positionSizeUp',
  'positionStretchIn',
  'positionStretchOut',
  'positionHairFlip',
  'positionHairFlipped',
  'scaleShort',
  'scaleTall',
  'scaleThin',
  'scaleFat',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/assets/mii-editor-icons.json');

const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`Failed to fetch EditorIcons.ts (${res.status})`);
  process.exit(1);
}
const src = await res.text();

const out = {};
for (const key of KEYS) {
  const marker = `${key}: \``;
  const start = src.indexOf(marker);
  if (start === -1) {
    console.warn('missing:', key);
    continue;
  }
  let i = start + marker.length;
  let svg = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '`' && src[i - 1] !== '\\') break;
    svg += ch;
    i++;
  }
  out[key] = svg.trim();
}

writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} icons → ${outPath}`);
