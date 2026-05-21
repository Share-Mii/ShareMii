import { openConfirmModal } from '@/components/ConfirmModal/ConfirmModal';
import { deleteMii } from '@/services/supabase';
import type { Mii } from '@/types';

export function confirmDeleteMii(mii: Mii, onDeleted: () => void): void {
  openConfirmModal({
    title: 'Delete Mii?',
    message: `Delete "${mii.name}"? This can't be undone.`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      await deleteMii(mii.id);
      onDeleted();
    },
  });
}
