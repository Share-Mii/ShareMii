import { navigateTo } from '@/utils/navigation';

export function navigateToMiiMakerEdit(miiId: string): void {
  navigateTo(`/edit/${miiId}`);
}
