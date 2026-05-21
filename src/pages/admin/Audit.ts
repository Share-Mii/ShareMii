import { listAuditLog } from '@/services/admin';
import type { Profile } from '@/types';
import { wrapAdminPage } from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';

export async function renderAdminAudit(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');

  try {
    const rows = await listAuditLog(100);
    const wrap = document.createElement('div');
    wrap.className = 'admin-table-wrap';

    if (!rows.length) {
      wrap.innerHTML = '<p class="admin-meta">No audit entries yet.</p>';
    } else {
      const table = document.createElement('table');
      table.className = 'admin-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      for (const row of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(new Date(row.created_at).toLocaleString())}</td>
          <td>${escapeHtml(row.actor_username ?? row.actor_id)}</td>
          <td>${escapeHtml(row.action)}</td>
          <td>${escapeHtml(row.target_type)} ${row.target_id ? escapeHtml(row.target_id.slice(0, 8)) + '…' : ''}</td>
        `;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
    }

    content.appendChild(wrap);
  } catch (err) {
    content.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load audit log.')}</p>`;
  }

  container.replaceChildren(wrapAdminPage(profile, 'Audit log', content));
}
