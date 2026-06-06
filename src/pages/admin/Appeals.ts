import { adminListAppeals, adminResolveAppeal } from '@/services/safety';
import type { ContentAppeal, Profile } from '@/types';
import {
  formatReportAge,
  wrapAdminPage,
} from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';

export async function renderAdminAppeals(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');
  const tableHost = document.createElement('div');
  content.appendChild(tableHost);

  async function load(): Promise<void> {
    tableHost.replaceChildren();
    try {
      const appeals = await adminListAppeals('open');
      tableHost.appendChild(renderTable(appeals));
    } catch (err) {
      tableHost.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load appeals.')}</p>`;
    }
  }

  function renderTable(appeals: ContentAppeal[]): HTMLElement {
    if (!appeals.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No open appeals.';
      return empty;
    }

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Type</th>
          <th>Target</th>
          <th>Reason</th>
          <th>Age</th>
          <th>Actions</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');

    for (const a of appeals) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(a.target_type)}</td>
        <td><code>${escapeHtml(a.target_id.slice(0, 8))}…</code></td>
        <td>${escapeHtml(a.reason || '—')}</td>
        <td>${formatReportAge(a.created_at)}</td>
      `;

      const actions = document.createElement('td');
      actions.className = 'admin-table__actions';

      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'pill-btn pill-btn--outline interactive';
      approve.textContent = 'Approve';
      approve.addEventListener('click', () => {
        const note = window.prompt('Optional note for appellant:') ?? '';
        void adminResolveAppeal(a.id, 'approved', note)
          .then(() => load())
          .catch((err) =>
            alert(err instanceof Error ? err.message : 'Failed'),
          );
      });

      const deny = document.createElement('button');
      deny.type = 'button';
      deny.className = 'pill-btn pill-btn--outline interactive';
      deny.textContent = 'Deny';
      deny.addEventListener('click', () => {
        const note = window.prompt('Optional note for appellant:') ?? '';
        void adminResolveAppeal(a.id, 'denied', note)
          .then(() => load())
          .catch((err) =>
            alert(err instanceof Error ? err.message : 'Failed'),
          );
      });

      actions.append(approve, deny);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    return table;
  }

  await load();
  container.replaceChildren(wrapAdminPage(profile, 'Appeals', content));
}
