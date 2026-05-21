import {
  assignReport,
  deleteComment,
  getReportDetail,
  hideMii,
  hideProfile,
  resolveReport,
  setReportPriority,
} from '@/services/admin';
import { fetchMiiById, getSupabaseClient } from '@/services/supabase';
import type { ContentReport, Profile, ReportPriority } from '@/types';
import type { AdminPageOptions } from '@/pages/admin/adminShell';
import { wrapAdminPage } from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';

export async function renderAdminReportDetail(
  container: HTMLElement,
  profile: Profile,
  reportId: string,
): Promise<void> {
  const content = document.createElement('div');
  content.className = 'admin-report-detail';
  const pageOptions: AdminPageOptions = {};

  try {
    const detail = await getReportDetail(reportId);
    const report = detail.report;

    pageOptions.subtitle = `${report.target_type} target · ref ${report.id.slice(0, 8)}…`;

    const back = document.createElement('a');
    back.href = '#/admin/reports';
    back.className = 'admin-back-link interactive';
    back.textContent = '← Back to report queue';

    const staffBanner = document.createElement('p');
    staffBanner.className = 'admin-staff-banner';
    staffBanner.textContent =
      'Staff-only view — actions apply to live content. Resolution notes are stored with the case.';

    const grid = document.createElement('div');
    grid.className = 'admin-detail-grid';

    const metaPanel = document.createElement('section');
    metaPanel.className = 'admin-panel';
    metaPanel.setAttribute('aria-labelledby', 'report-detail-summary-heading');
    metaPanel.innerHTML = `
      <h2 id="report-detail-summary-heading" class="admin-panel__title">Case summary</h2>
      <p class="admin-panel__lead">Identifiers and reporter context for this report.</p>
      <dl class="admin-kv">
        <dt>Status</dt><dd><span class="admin-status-pill">${escapeHtml(report.status)}</span></dd>
        <dt>Priority</dt><dd><span class="${report.priority === 'urgent' ? 'admin-badge admin-badge--urgent' : 'admin-status-pill'}">${escapeHtml(report.priority)}</span></dd>
        <dt>Reason</dt><dd>${escapeHtml(report.reason)}</dd>
        <dt>Reporter</dt><dd>${escapeHtml(detail.reporter_username ?? report.reporter_id)}</dd>
        <dt>Target</dt><dd><span class="admin-mono">${escapeHtml(report.target_type)}</span> · <span class="admin-mono">${escapeHtml(report.target_id)}</span></dd>
        <dt>User notes</dt><dd>${escapeHtml(report.details || '—')}</dd>
        <dt>Related open</dt><dd>${detail.related_reports.length}</dd>
      </dl>
    `;

    const previewPanel = document.createElement('section');
    previewPanel.className = 'admin-panel';
    previewPanel.setAttribute('aria-labelledby', 'report-detail-preview-heading');
    const previewTitle = document.createElement('h2');
    previewTitle.id = 'report-detail-preview-heading';
    previewTitle.className = 'admin-panel__title';
    previewTitle.textContent = 'Reported content';
    const previewLead = document.createElement('p');
    previewLead.className = 'admin-panel__lead';
    previewLead.textContent =
      'Live preview of the reported Mii, comment, or profile target.';
    const previewBody = document.createElement('div');
    previewBody.className = 'admin-preview-body';
    previewBody.setAttribute('role', 'region');
    previewBody.setAttribute('aria-label', 'Moderation preview');
    previewPanel.append(previewTitle, previewLead, previewBody);
    await renderPreview(report, previewBody);

    const actionsPanel = document.createElement('section');
    actionsPanel.className = 'admin-panel admin-panel--full';
    actionsPanel.setAttribute('aria-labelledby', 'report-detail-actions-heading');
    const actionsTitle = document.createElement('h2');
    actionsTitle.id = 'report-detail-actions-heading';
    actionsTitle.className = 'admin-panel__title';
    actionsTitle.textContent = 'Actions';
    const actionsLead = document.createElement('p');
    actionsLead.className = 'admin-panel__lead';
    actionsLead.textContent =
      'Assign ownership, adjust priority, resolve the ticket, or take action on the underlying content.';

    const noteInput = document.createElement('textarea');
    noteInput.className = 'admin-input admin-input--textarea';
    noteInput.rows = 3;
    noteInput.placeholder = 'Optional note for staff (shown on resolve / dismiss / hides)';
    noteInput.maxLength = 500;

    const noteGroup = document.createElement('div');
    noteGroup.className = 'admin-actions-group';
    noteGroup.innerHTML =
      '<h3 class="admin-actions-group__title">Case note</h3>';
    const noteField = document.createElement('div');
    noteField.className = 'admin-field';
    noteField.append(noteInput);
    noteGroup.appendChild(noteField);

    const queueGroup = document.createElement('div');
    queueGroup.className = 'admin-actions-group';
    queueGroup.innerHTML =
      '<h3 class="admin-actions-group__title">Queue</h3>';
    const queueRow = document.createElement('div');
    queueRow.className = 'admin-actions-row';
    const assignBtn = btn('Assign to me', async () => {
      await assignReport(reportId);
      await reload();
    });
    queueRow.appendChild(assignBtn);
    queueGroup.appendChild(queueRow);

    const priorityGroup = document.createElement('div');
    priorityGroup.className = 'admin-actions-group';
    priorityGroup.innerHTML =
      '<h3 class="admin-actions-group__title">Priority</h3>';
    const priorityRow = document.createElement('div');
    priorityRow.className = 'admin-actions-row';
    const prioritySelect = createCustomSelect({
      ariaLabel: 'Report priority',
      variant: 'default',
      value: report.priority,
      options: (['low', 'normal', 'high', 'urgent'] as ReportPriority[]).map(
        (p) => ({ value: p, label: p }),
      ),
    });
    const priorityBtn = btn('Save priority', async () => {
      await setReportPriority(
        reportId,
        prioritySelect.getValue() as ReportPriority,
      );
      await reload();
    });
    priorityRow.append(prioritySelect.root, priorityBtn);
    priorityGroup.appendChild(priorityRow);

    const resolutionGroup = document.createElement('div');
    resolutionGroup.className = 'admin-actions-group';
    resolutionGroup.innerHTML =
      '<h3 class="admin-actions-group__title">Resolution</h3>';
    const resolutionRow = document.createElement('div');
    resolutionRow.className = 'admin-actions-row';
    const dismissBtn = btn('Dismiss report', async () => {
      await resolveReport(reportId, 'dismissed', noteInput.value);
      window.location.hash = '#/admin/reports';
    });
    const resolveBtn = btnPrimary('Mark resolved', async () => {
      await resolveReport(reportId, 'resolved', noteInput.value);
      window.location.hash = '#/admin/reports';
    });
    resolutionRow.append(dismissBtn, resolveBtn);
    resolutionGroup.appendChild(resolutionRow);

    const moderationGroup = document.createElement('div');
    moderationGroup.className = 'admin-actions-group';
    moderationGroup.innerHTML =
      '<h3 class="admin-actions-group__title">Content moderation</h3>';
    const modRow = document.createElement('div');
    modRow.className = 'admin-actions-row';

    const hideMiiBtn = btn('Hide Mii', async () => {
      if (report.target_type !== 'mii') return;
      await hideMii(report.target_id, noteInput.value);
      await reload();
    });
    const deleteCommentBtn = btn('Remove comment', async () => {
      if (report.target_type !== 'comment') return;
      await deleteComment(report.target_id, noteInput.value);
      await reload();
    });
    const hideProfileBtn = btn('Hide profile', async () => {
      if (report.target_type !== 'profile') return;
      await hideProfile(report.target_id, noteInput.value);
      await reload();
    });

    if (report.target_type === 'mii') modRow.appendChild(hideMiiBtn);
    if (report.target_type === 'comment') modRow.appendChild(deleteCommentBtn);
    if (report.target_type === 'profile') modRow.appendChild(hideProfileBtn);
    if (!modRow.childNodes.length) {
      const none = document.createElement('p');
      none.className = 'admin-actions-group__empty';
      none.textContent =
        'No direct hide/remove action for this target type from this screen.';
      moderationGroup.appendChild(none);
    } else {
      moderationGroup.appendChild(modRow);
    }

    const actionsStack = document.createElement('div');
    actionsStack.className = 'admin-actions-stack';
    actionsStack.append(
      noteGroup,
      queueGroup,
      priorityGroup,
      resolutionGroup,
      moderationGroup,
    );

    actionsPanel.append(actionsTitle, actionsLead, actionsStack);

    grid.append(metaPanel, previewPanel, actionsPanel);
    content.append(back, staffBanner, grid);

    async function reload(): Promise<void> {
      await renderAdminReportDetail(container, profile, reportId);
    }
  } catch (err) {
    content.appendChild(
      (() => {
        const p = document.createElement('p');
        p.className = 'page-error';
        p.textContent =
          err instanceof Error
            ? err.message
            : 'Failed to load report.';
        return p;
      })(),
    );
  }

  container.replaceChildren(
    wrapAdminPage(profile, 'Report detail', content, pageOptions),
  );
}

function btn(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pill-btn pill-btn--outline interactive';
  b.textContent = label;
  b.addEventListener('click', () =>
    void onClick().catch((e) =>
      alert(e instanceof Error ? e.message : 'Action failed'),
    ),
  );
  return b;
}

function btnPrimary(
  label: string,
  onClick: () => Promise<void>,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pill-btn pill-btn--filled interactive';
  b.textContent = label;
  b.addEventListener('click', () =>
    void onClick().catch((e) =>
      alert(e instanceof Error ? e.message : 'Action failed'),
    ),
  );
  return b;
}

async function renderPreview(
  report: ContentReport,
  host: HTMLElement,
): Promise<void> {
  if (report.target_type === 'mii') {
    const mii = await fetchMiiById(report.target_id);
    if (!mii) {
      host.textContent = 'Mii not found or hidden.';
      return;
    }
    host.innerHTML = `<p class="admin-preview-body__title">${escapeHtml(mii.name)}</p><p class="admin-preview-body__meta">by ${escapeHtml(mii.creator_name)}</p><p class="admin-preview-body__text">${escapeHtml(mii.description || 'No description.')}</p>`;
    return;
  }

  if (report.target_type === 'comment') {
    const { data } = await getSupabaseClient()
      .from('comments')
      .select('*')
      .eq('id', report.target_id)
      .maybeSingle();
    if (!data) {
      host.textContent = 'Comment not found.';
      return;
    }
    const c = data as { author_name: string; body: string };
    host.innerHTML = `<p class="admin-preview-body__meta">${escapeHtml(c.author_name)}</p><p class="admin-preview-body__text">${escapeHtml(c.body)}</p>`;
    return;
  }

  host.innerHTML = `<p class="admin-preview-body__text">Profile target</p><p class="admin-mono admin-preview-body__meta">${escapeHtml(report.target_id)}</p>`;
}
