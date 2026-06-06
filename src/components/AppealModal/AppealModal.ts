import './AppealModal.css';
import { submitContentAppeal } from '@/services/safety';
import { escapeHtml } from '@/utils/escapeHtml';

export function openAppealModal(opts: {
  targetType: 'mii' | 'comment' | 'profile';
  targetId: string;
  targetLabel: string;
}): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'appeal-modal-backdrop';
  backdrop.setAttribute('role', 'presentation');

  const modal = document.createElement('div');
  modal.className = 'appeal-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'appeal-modal-title');

  modal.innerHTML = `
    <h2 id="appeal-modal-title" class="appeal-modal__title">Appeal moderation</h2>
    <p class="appeal-modal__lead">Explain why <strong>${escapeHtml(opts.targetLabel)}</strong> should be restored. Staff will review your appeal.</p>
  `;

  const form = document.createElement('form');
  form.className = 'appeal-modal__form';

  const textarea = document.createElement('textarea');
  textarea.className = 'appeal-modal__input';
  textarea.name = 'reason';
  textarea.placeholder = 'Why should this be visible again?';
  textarea.maxLength = 2000;
  textarea.rows = 4;
  textarea.required = true;

  const actions = document.createElement('div');
  actions.className = 'appeal-modal__actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pill-btn pill-btn--outline interactive';
  cancel.textContent = 'Cancel';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'pill-btn pill-btn--filled interactive';
  submit.textContent = 'Submit appeal';

  actions.append(cancel, submit);
  form.append(textarea, actions);
  modal.appendChild(form);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close(): void {
    backdrop.remove();
  }

  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = String(new FormData(form).get('reason') ?? '').trim();
    if (!reason) return;
    submit.disabled = true;
    void submitContentAppeal(opts.targetType, opts.targetId, reason)
      .then(() => {
        alert('Appeal submitted. Staff will review it soon.');
        close();
      })
      .catch((err) => {
        alert(err instanceof Error ? err.message : 'Could not submit appeal.');
        submit.disabled = false;
      });
  });

  textarea.focus();
}
