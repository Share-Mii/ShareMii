import type { RenderOptions } from '@/services/miiApi';

export interface MiiViewPreset {
  id: string;
  label: string;
  characterYRotate?: number;
  cameraXRotate?: number;
}

export const MII_STANDARD_VIEWS: readonly MiiViewPreset[] = [
  { id: 'front', label: 'Front', characterYRotate: 0 },
  { id: 'quarter', label: '3/4', characterYRotate: 45 },
  { id: 'side', label: 'Side', characterYRotate: 90 },
  { id: 'back', label: 'Back', characterYRotate: 180 },
] as const;

export function applyMiiView(
  base: RenderOptions,
  view: MiiViewPreset,
): RenderOptions {
  const next: RenderOptions = { ...base };
  if (view.characterYRotate !== undefined) {
    next.characterYRotate = view.characterYRotate;
  }
  if (view.cameraXRotate !== undefined) {
    next.cameraXRotate = view.cameraXRotate;
  }
  return next;
}

export function getMiiView(id: string): MiiViewPreset | undefined {
  return MII_STANDARD_VIEWS.find((v) => v.id === id);
}
