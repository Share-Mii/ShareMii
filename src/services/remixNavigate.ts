import type { Mii } from '@/types';
import { navigateTo } from '@/utils/navigation';

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
  navigateTo(`/create/remix/${mii.id}`);
}
