import { listModerationAutoFlags } from '@/services/admin';
import type { ModerationAutoFlag, Profile } from '@/types';
import {
  formatReportAge,
  wrapAdminPage,
} from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';

export async function renderAdminModerationQueue(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');

  const lead = document.createElement('p');
  lead.className = 'admin-meta';
  lead.textContent =
    'Rows are created when automated checks hide a comment, when the browser model flags toxicity or URLs after post, or when someone is blocked from saving profile or Mii text.';

  const toolbar = document.createElement('div');
  toolbar.className = 'admin-toolbar';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'pill-btn pill-btn--outline interactive';
  refreshBtn.textContent = 'Refresh';
  toolbar.appendChild(refreshBtn);

  const tableHost = document.createElement('div');
  content.append(lead, toolbar, tableHost);

  async function load(): Promise<void> {
    tableHost.replaceChildren();
    try {
      const rows = await listModerationAutoFlags(150);
      tableHost.appendChild(renderTable(rows));
    } catch (err) {
      tableHost.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Failed to load.')}</p>`;
    }
  }

  refreshBtn.addEventListener('click', () => void load());

  container.replaceChildren(
    wrapAdminPage(profile, 'Automated moderation', content, {
      subtitle: 'Silent holds, links, and blocked field attempts',
    }),
  );
  await load();
}

function renderTable(rows: ModerationAutoFlag[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'admin-table-wrap';

  if (!rows.length) {
    wrap.innerHTML =
      '<p class="admin-meta">No automated moderation events in the recent window.</p>';
    return wrap;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>When</th>
        <th>Kind</th>
        <th>Excerpt</th>
        <th>Detail</th>
        <th>Links</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  for (const r of rows) {
    const tr = document.createElement('tr');

    const tdWhen = document.createElement('td');
    tdWhen.textContent = formatReportAge(r.created_at);

    const tdKind = document.createElement('td');
    tdKind.textContent = r.kind;

    const tdExcerpt = document.createElement('td');
    tdExcerpt.className = 'admin-table__clamp';
    tdExcerpt.textContent = r.body_excerpt;

    const tdDetail = document.createElement('td');
    tdDetail.className = 'admin-table__clamp';
    tdDetail.textContent = r.detail || '—';

    const tdLinks = document.createElement('td');
    const fragments: string[] = [];
    if (r.mii_id) {
      fragments.push(
        `<a class="interactive" href="#/mii/${escapeHtml(r.mii_id)}">Mii</a>`,
      );
    }
    if (r.comment_id) {
      fragments.push(
        `<span class="admin-mono" title="${escapeHtml(r.comment_id)}">comment</span>`,
      );
    }
    if (r.user_id) {
      fragments.push(
        `<span class="admin-mono" title="${escapeHtml(r.user_id)}">user</span>`,
      );
    }
    tdLinks.innerHTML = fragments.length ? fragments.join(' · ') : '—';

    tr.append(tdWhen, tdKind, tdExcerpt, tdDetail, tdLinks);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
