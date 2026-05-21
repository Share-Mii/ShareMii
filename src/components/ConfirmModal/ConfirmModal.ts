import './ConfirmModal.css';
import '@/components/shared.css';
import { icon } from '@/utils/icon';

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

let activeTeardown: (() => void) | null = null;

function closeConfirmModal(): void {
  activeTeardown?.();
  activeTeardown = null;
  document.querySelectorAll('.confirm-modal-overlay').forEach((el) => el.remove());
}

export function openConfirmModal(options: ConfirmModalOptions): () => void {
  closeConfirmModal();

  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'confirm-modal-title');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'confirm-modal__close interactive';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('xmark');

  const title = document.createElement('h2');
  title.id = 'confirm-modal-title';
  title.className = 'confirm-modal__title';
  title.textContent = options.title;

  const message = document.createElement('p');
  message.className = 'confirm-modal__message';
  message.textContent = options.message;

  const actions = document.createElement('div');
  actions.className = 'confirm-modal__actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className =
    'pill-btn pill-btn--outline interactive confirm-modal__btn';
  cancelBtn.textContent = options.cancelLabel ?? 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = options.danger
    ? 'pill-btn pill-btn--filled interactive confirm-modal__btn confirm-modal__btn--danger'
    : 'pill-btn pill-btn--filled interactive confirm-modal__btn';
  confirmBtn.textContent = options.confirmLabel ?? 'Confirm';

  actions.append(cancelBtn, confirmBtn);
  modal.append(closeBtn, title, message, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let busy = false;

  const dismiss = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (activeTeardown === dismiss) activeTeardown = null;
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !busy) {
      dismiss();
      options.onCancel?.();
    }
  };

  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !busy) {
      dismiss();
      options.onCancel?.();
    }
  });

  closeBtn.addEventListener('click', () => {
    if (busy) return;
    dismiss();
    options.onCancel?.();
  });

  cancelBtn.addEventListener('click', () => {
    if (busy) return;
    dismiss();
    options.onCancel?.();
  });

  confirmBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    confirmBtn.setAttribute('disabled', 'true');
    cancelBtn.setAttribute('disabled', 'true');
    closeBtn.setAttribute('disabled', 'true');
    try {
      await options.onConfirm();
      dismiss();
    } catch (err) {
      busy = false;
      confirmBtn.removeAttribute('disabled');
      cancelBtn.removeAttribute('disabled');
      closeBtn.removeAttribute('disabled');
      alert(err instanceof Error ? err.message : 'Something went wrong.');
    }
  });

  activeTeardown = dismiss;
  return dismiss;
}
