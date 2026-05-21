import './ReportModal.css';
import '@/components/shared.css';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { REPORT_REASONS, submitContentReport } from '@/services/reports';
import type { ReportReason, ReportTargetType } from '@/types';
import { icon } from '@/utils/icon';

export interface OpenReportModalOptions {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
}

export function openReportModal(options: OpenReportModalOptions): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'report-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'report-modal';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = (): void => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  void getAuthSession().then((session) => {
    if (!isLoggedIn(session)) {
      close();
      openLoginModal();
      return;
    }
    renderForm();
  });

  function renderForm(): void {
    modal.replaceChildren();

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className =
      'pill-btn pill-btn--outline interactive report-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = icon('xmark');
    closeBtn.addEventListener('click', close);

    const title = document.createElement('h2');
    title.className = 'report-modal__title';
    title.id = 'report-modal-title';
    title.textContent = 'Report content';

    const hint = document.createElement('p');
    hint.className = 'report-modal__hint';
    hint.textContent = options.targetLabel
      ? `Reporting: ${options.targetLabel}`
      : 'Help us keep ShareMii safe. Reports are reviewed by our team.';

    const form = document.createElement('form');

    const reasonGroup = document.createElement('div');
    reasonGroup.className = 'report-modal__field';
    const reasonLabel = document.createElement('label');
    reasonLabel.htmlFor = 'report-reason';
    reasonLabel.textContent = 'Reason';
    const reasonSelect = createCustomSelect({
      id: 'report-reason',
      ariaLabel: 'Report reason',
      variant: 'default',
      options: REPORT_REASONS.map((r) => ({
        value: r.value,
        label: r.label,
      })),
    });

    const detailsGroup = document.createElement('div');
    detailsGroup.className = 'report-modal__field';
    const detailsLabel = document.createElement('label');
    detailsLabel.htmlFor = 'report-details';
    detailsLabel.textContent = 'Additional details (optional)';
    const detailsArea = document.createElement('textarea');
    detailsArea.id = 'report-details';
    detailsArea.rows = 3;
    detailsArea.maxLength = 500;
    detailsArea.placeholder = 'Describe the issue…';

    const errorEl = document.createElement('p');
    errorEl.className = 'report-modal__error';
    errorEl.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'report-modal__actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'pill-btn pill-btn--outline interactive';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'pill-btn pill-btn--filled interactive';
    submitBtn.textContent = 'Submit report';

    reasonGroup.append(reasonLabel, reasonSelect.root);
    detailsGroup.append(detailsLabel, detailsArea);
    actions.append(cancelBtn, submitBtn);
    form.append(reasonGroup, detailsGroup, errorEl, actions);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      submitBtn.setAttribute('disabled', 'true');

      try {
        await submitContentReport(
          options.targetType,
          options.targetId,
          reasonSelect.getValue() as ReportReason,
          detailsArea.value,
        );
        renderSuccess();
      } catch (err) {
        errorEl.textContent =
          err instanceof Error ? err.message : 'Could not submit report.';
        errorEl.hidden = false;
        submitBtn.removeAttribute('disabled');
      }
    });

    modal.append(closeBtn, title, hint, form);
  }

  function renderSuccess(): void {
    modal.replaceChildren();
    const box = document.createElement('div');
    box.className = 'report-modal__success';
    box.innerHTML =
      '<p><strong>Thank you.</strong> We received your report and will review it.</p>';
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'pill-btn pill-btn--filled interactive';
    done.textContent = 'Done';
    done.addEventListener('click', close);
    box.appendChild(done);
    modal.appendChild(box);
  }

  return close;
}
