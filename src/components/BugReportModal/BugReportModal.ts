import '../ReportModal/ReportModal.css';
import '@/components/shared.css';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { submitBugReport } from '@/services/bugReports';
import { icon } from '@/utils/icon';

export function openBugReportModal(): () => void {
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
    title.textContent = 'Report a bug';

    const hint = document.createElement('p');
    hint.className = 'report-modal__hint';
    hint.textContent =
      'Describe what went wrong. Our team reviews bug reports and may follow up if we need more information.';

    const form = document.createElement('form');

    const titleGroup = document.createElement('div');
    titleGroup.className = 'report-modal__field';
    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'bug-title';
    titleLabel.textContent = 'Summary';
    const titleInput = document.createElement('input');
    titleInput.id = 'bug-title';
    titleInput.type = 'text';
    titleInput.maxLength = 120;
    titleInput.required = true;
    titleInput.placeholder = 'e.g. Upload fails on Safari';
    titleGroup.append(titleLabel, titleInput);

    const detailsGroup = document.createElement('div');
    detailsGroup.className = 'report-modal__field';
    const detailsLabel = document.createElement('label');
    detailsLabel.htmlFor = 'bug-description';
    detailsLabel.textContent = 'What happened?';
    const detailsArea = document.createElement('textarea');
    detailsArea.id = 'bug-description';
    detailsArea.rows = 5;
    detailsArea.maxLength = 2000;
    detailsArea.required = true;
    detailsArea.placeholder =
      'Steps to reproduce, what you expected, and what actually happened…';

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
    submitBtn.textContent = 'Submit bug report';

    detailsGroup.append(detailsLabel, detailsArea);
    actions.append(cancelBtn, submitBtn);
    form.append(titleGroup, detailsGroup, errorEl, actions);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      submitBtn.setAttribute('disabled', 'true');

      try {
        await submitBugReport(
          titleInput.value,
          detailsArea.value,
          window.location.href,
          navigator.userAgent,
        );
        renderSuccess();
      } catch (err) {
        errorEl.textContent =
          err instanceof Error ? err.message : 'Could not submit bug report.';
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
      '<p><strong>Thank you.</strong> We received your bug report and will investigate.</p>';
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
