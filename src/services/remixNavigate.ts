import type { Mii } from '@/types';

export function miiDataForEditor(
  mii: Pick<Mii, 'mii_data' | 'mii_data_download'>,
): string {
  const data = mii.mii_data || mii.mii_data_download;
  if (!data) {
    throw new Error('This Mii has no data available to remix.');
  }
  return data;
}

export function navigateToRemix(mii: Mii): void {
  window.location.hash = `#/create/remix/${mii.id}`;
}
