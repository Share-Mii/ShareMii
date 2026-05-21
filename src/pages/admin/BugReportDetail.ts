import {
  assignBugReport,
  getBugReportDetail,
  resolveBugReport,
  setBugReportPriority,
} from '@/services/admin';
import type { BugReport, Profile, ReportPriority } from '@/types';
import type { AdminPageOptions } from '@/pages/admin/adminShell';
import { wrapAdminPage } from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';

export async function renderAdminBugReportDetail(
  container: HTMLElement,
  profile: Profile,
  reportId: string,
): Promise<void> {
  const content = document.createElement('div');
  content.className = 'admin-report-detail';
  const pageOptions: AdminPageOptions = {};

  async function reload(): Promise<void> {
    const detail = await getBugReportDetail(reportId);
    renderDetail(detail.report);
  }

  function renderDetail(report: BugReport): void {
    content.replaceChildren();
    pageOptions.subtitle = `Bug · ref ${report.id.slice(0, 8)}…`;

    const back = document.createElement('a');
    back.href = '#/admin/bugs';
    back.className = 'admin-back-link interactive';
    back.textContent = '← Back to bug reports';

    const metaPanel = document.createElement('section');
    metaPanel.className = 'admin-panel';
    metaPanel.innerHTML = `
      <h2 class="admin-panel__title">Report summary</h2>
      <dl class="admin-kv">
        <dt>Status</dt><dd><span class="admin-status-pill">${escapeHtml(report.status)}</span></dd>
        <dt>Priority</dt><dd><span class="admin-status-pill">${escapeHtml(report.priority)}</span></dd>
        <dt>Reporter</dt><dd>${escapeHtml(report.reporter_username ?? report.reporter_id ?? '—')}</dd>
        <dt>Page URL</dt><dd>${escapeHtml(report.page_url || '—')}</dd>
        <dt>User agent</dt><dd class="admin-mono admin-mono--wrap">${escapeHtml(report.user_agent || '—')}</dd>
        <dt>Description</dt><dd>${escapeHtml(report.description)}</dd>
        ${report.resolution_note ? `<dt>Resolution note</dt><dd>${escapeHtml(report.resolution_note)}</dd>` : ''}
      </dl>
    `;

    const actionsPanel = document.createElement('section');
    actionsPanel.className = 'admin-panel admin-panel--full';

    const noteInput = document.createElement('textarea');
    noteInput.className = 'admin-input admin-input--textarea';
    noteInput.rows = 3;
    noteInput.placeholder = 'Optional resolution note';
    noteInput.maxLength = 1000;

    const assignBtn = document.createElement('button');
    assignBtn.type = 'button';
    assignBtn.className = 'pill-btn pill-btn--outline interactive';
    assignBtn.textContent = 'Assign to me';
    assignBtn.addEventListener('click', () => {
      void (async () => {
        try {
          await assignBugReport(reportId);
          await reload();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Assign failed');
        }
      })();
    });

    const prioritySelect = createCustomSelect({
      ariaLabel: 'Priority',
      variant: 'default',
      value: report.priority,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ],
    });

    const setPriorityBtn = document.createElement('button');
    setPriorityBtn.type = 'button';
    setPriorityBtn.className = 'pill-btn pill-btn--outline interactive';
    setPriorityBtn.textContent = 'Set priority';
    setPriorityBtn.addEventListener('click', () => {
      void (async () => {
        try {
          await setBugReportPriority(
            reportId,
            prioritySelect.getValue() as ReportPriority,
          );
          await reload();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Update failed');
        }
      })();
    });

    const resolveBtn = document.createElement('button');
    resolveBtn.type = 'button';
    resolveBtn.className = 'pill-btn pill-btn--filled interactive';
    resolveBtn.textContent = 'Resolve';
    resolveBtn.addEventListener('click', () => {
      void (async () => {
        try {
          await resolveBugReport(reportId, 'resolved', noteInput.value);
          await reload();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Resolve failed');
        }
      })();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'pill-btn pill-btn--outline interactive';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => {
      if (!window.confirm('Dismiss this bug report?')) return;
      void (async () => {
        try {
          await resolveBugReport(reportId, 'dismissed', noteInput.value);
          await reload();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Dismiss failed');
        }
      })();
    });

    const actionsRow = document.createElement('div');
    actionsRow.className = 'admin-actions-row';
    actionsRow.append(
      assignBtn,
      prioritySelect.root,
      setPriorityBtn,
      resolveBtn,
      dismissBtn,
    );

    actionsPanel.innerHTML = '<h2 class="admin-panel__title">Actions</h2>';
    actionsPanel.append(noteInput, actionsRow);
    content.append(back, metaPanel, actionsPanel);
    container.replaceChildren(
      wrapAdminPage(profile, report.title, content, pageOptions),
    );
  }

  try {
    await reload();
  } catch (err) {
    content.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load bug report.')}</p>`;
    container.replaceChildren(wrapAdminPage(profile, 'Bug report', content));
  }
}
