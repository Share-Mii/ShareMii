import { decodeMii } from 'miijs';
import { base64ToUint8 } from '@/services/miiApi';
import { TL_HAT_NAMES, TL_OUTFIT_NAMES } from '@/data/tlItemNames';

export type TomodachiClothingKind = 'outfit' | 'hat';

export interface TomodachiClothingItem {
  kind: TomodachiClothingKind;
  name: string;
}

export interface TomodachiClothing {
  outfitName: string | null;
  hatName: string | null;
  items: TomodachiClothingItem[];
}

function buildClothingItems(
  outfitName: string | null,
  hatName: string | null,
): TomodachiClothingItem[] {
  const items: TomodachiClothingItem[] = [];
  if (outfitName) items.push({ kind: 'outfit', name: outfitName });
  if (hatName) items.push({ kind: 'hat', name: hatName });
  return items;
}

const NO_OUTFIT = new Set(['0000', '']);
const NO_HAT = new Set(['FFFF', '']);

function normalizeItemId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim().toUpperCase();
  if (!trimmed) return null;
  return trimmed.padStart(4, '0').slice(-4);
}

function lookupOutfit(id: string | null): string | null {
  if (!id || NO_OUTFIT.has(id)) return null;
  return TL_OUTFIT_NAMES[id] ?? null;
}

function lookupHat(id: string | null): string | null {
  if (!id || NO_HAT.has(id)) return null;
  return TL_HAT_NAMES[id] ?? TL_OUTFIT_NAMES[id] ?? null;
}

export async function getTomodachiClothing(
  miiDataDownloadBase64: string,
): Promise<TomodachiClothing> {
  const bytes = base64ToUint8(miiDataDownloadBase64);
  const miiObj = (await decodeMii(bytes)) as {
    tl?: { clothing?: { outfit?: unknown; hat?: unknown } };
  };

  const clothing = miiObj.tl?.clothing;
  if (!clothing) {
    return { outfitName: null, hatName: null, items: [] };
  }

  const outfitName = lookupOutfit(normalizeItemId(clothing.outfit));
  const hatName = lookupHat(normalizeItemId(clothing.hat));

  return {
    outfitName,
    hatName,
    items: buildClothingItems(outfitName, hatName),
  };
}

export function isTomodachiMii(mii: {
  mii_data_download: string | null;
}): boolean {
  return mii.mii_data_download != null;
}
