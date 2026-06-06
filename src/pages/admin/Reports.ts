import { bulkDismissReports, listReports } from '@/services/admin';
import type { ContentReport, Profile, ReportStatus } from '@/types';
import {
  formatReportAge,
  reportAgeClass,
  wrapAdminPage,
} from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';

export async function renderAdminReports(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');

  const toolbar = document.createElement('div');
  toolbar.className = 'admin-toolbar';

  const statusFilter = createCustomSelect({
    ariaLabel: 'Filter by status',
    variant: 'default',
    value: '',
    options: [
      { value: '', label: 'All statuses' },
      { value: 'open', label: 'Open' },
      { value: 'in_review', label: 'In review' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'dismissed', label: 'Dismissed' },
    ],
    onChange: () => void load(),
  });

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'pill-btn pill-btn--outline interactive';
  refreshBtn.textContent = 'Refresh';

  const bulkDismissBtn = document.createElement('button');
  bulkDismissBtn.type = 'button';
  bulkDismissBtn.className = 'pill-btn pill-btn--outline interactive';
  bulkDismissBtn.textContent = 'Dismiss all open';

  toolbar.append(statusFilter.root, refreshBtn, bulkDismissBtn);
  content.appendChild(toolbar);

  const tableHost = document.createElement('div');
  content.appendChild(tableHost);

  async function load(): Promise<void> {
    tableHost.replaceChildren();
    const status = statusFilter.getValue() as ReportStatus | '';
    try {
      const reports = await listReports(status || null);
      tableHost.appendChild(renderTable(reports));
    } catch (err) {
      tableHost.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load reports.')}</p>`;
    }
  }

  refreshBtn.addEventListener('click', () => void load());
  bulkDismissBtn.addEventListener('click', () => {
    void (async () => {
      try {
        const reports = await listReports('open');
        const ids = reports.map((r) => r.id);
        if (!ids.length) {
          alert('No open reports to dismiss.');
          return;
        }
        if (!window.confirm(`Dismiss ${ids.length} open report(s)?`)) return;
        const n = await bulkDismissReports(ids);
        alert(`Dismissed ${n} report(s).`);
        await load();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Bulk dismiss failed');
      }
    })();
  });

  container.replaceChildren(wrapAdminPage(profile, 'Report queue', content));
  await load();
}

function renderTable(reports: ContentReport[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'admin-table-wrap';

  if (!reports.length) {
    wrap.innerHTML = '<p class="admin-meta">No reports match this filter.</p>';
    return wrap;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Target</th>
        <th>Reason</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Age</th>
        <th>Related</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  for (const r of reports) {
    const tr = document.createElement('tr');
    tr.className = reportAgeClass(r.created_at);
    if (r.priority === 'urgent') tr.classList.add('admin-table__row--urgent');

    const link = document.createElement('a');
    link.href = `/admin/reports/${r.id}`;
    link.textContent = `${r.target_type} · ${r.id.slice(0, 8)}…`;

    tr.innerHTML = `
      <td></td>
      <td>${escapeHtml(r.reason)}</td>
      <td><span class="admin-badge${r.priority === 'urgent' ? ' admin-badge--urgent' : ''}">${escapeHtml(r.priority)}</span></td>
      <td><span class="admin-badge admin-badge--open">${escapeHtml(r.status)}</span></td>
      <td>${escapeHtml(formatReportAge(r.created_at))}</td>
      <td>${r.related_open_count ?? 0}</td>
    `;
    tr.querySelector('td')!.appendChild(link);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
