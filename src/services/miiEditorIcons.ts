
import iconsJson from '@/assets/mii-editor-icons.json';
import type { EditorCategoryId } from '@/services/miiEditor';

export type MiiEditorIconKey = keyof typeof iconsJson;

const ICONS = iconsJson as Record<MiiEditorIconKey, string>;

export const CATEGORY_EDITOR_ICONS: Record<EditorCategoryId, MiiEditorIconKey> = {
  general: 'scale',
  face: 'head',
  hair: 'hair',
  eyes: 'eyes',
  eyebrows: 'eyebrows',
  nose: 'nose',
  mouth: 'mouth',
  glasses: 'glasses',
  facialHair: 'facialHair',
};

function sanitizeSvg(svg: string): string {
  return svg.replace(/\s*class="[^"]*"/g, '');
}

export function getMiiEditorIconSvg(key: MiiEditorIconKey): string {
  return sanitizeSvg(ICONS[key] ?? '');
}

export function miiEditorIconHtml(
  key: MiiEditorIconKey,
  className = 'mii-editor-icon',
): string {
  const svg = getMiiEditorIconSvg(key);
  if (!svg) return '';
  return `<span class="${className}" aria-hidden="true">${svg}</span>`;
}

export function miiEditorIconForCategory(categoryId: EditorCategoryId): string {
  return miiEditorIconHtml(CATEGORY_EDITOR_ICONS[categoryId], 'mii-editor-icon mii-maker__cat-icon');
}
