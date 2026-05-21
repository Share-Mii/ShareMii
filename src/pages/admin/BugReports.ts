import { listBugReports } from '@/services/admin';
import type { BugReport, Profile, ReportStatus } from '@/types';
import {
  formatReportAge,
  reportAgeClass,
  wrapAdminPage,
} from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';

export async function renderAdminBugReports(
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

  toolbar.append(statusFilter.root, refreshBtn);
  content.appendChild(toolbar);

  const tableHost = document.createElement('div');
  content.appendChild(tableHost);

  async function load(): Promise<void> {
    tableHost.replaceChildren();
    const status = statusFilter.getValue() as ReportStatus | '';
    try {
      const reports = await listBugReports(status || null);
      tableHost.appendChild(renderTable(reports));
    } catch (err) {
      tableHost.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load bug reports.')}</p>`;
    }
  }

  refreshBtn.addEventListener('click', () => void load());

  container.replaceChildren(
    wrapAdminPage(profile, 'Bug reports', content, {
      subtitle: 'User-submitted technical issues',
    }),
  );
  await load();
}

function renderTable(reports: BugReport[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'admin-table-wrap';

  if (!reports.length) {
    wrap.innerHTML = '<p class="admin-meta">No bug reports match this filter.</p>';
    return wrap;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Title</th>
        <th>Reporter</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Age</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody')!;

  for (const report of reports) {
    const tr = document.createElement('tr');
    tr.className = reportAgeClass(report.created_at);

    const link = document.createElement('a');
    link.href = `#/admin/bugs/${report.id}`;
    link.className = 'admin-table__link interactive';
    link.textContent = report.title;

    tr.innerHTML = `
      <td></td>
      <td>${escapeHtml(report.reporter_username ?? report.reporter_id ?? '—')}</td>
      <td><span class="admin-status-pill">${escapeHtml(report.priority)}</span></td>
      <td><span class="admin-status-pill">${escapeHtml(report.status)}</span></td>
      <td>${escapeHtml(formatReportAge(report.created_at))}</td>
    `;
    tr.querySelector('td')!.appendChild(link);
    tbody.appendChild(tr);
  }

  wrap.appendChild(table);
  return wrap;
}
