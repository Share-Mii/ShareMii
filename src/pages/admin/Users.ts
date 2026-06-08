import {
  applyRestriction,
  liftRestriction,
  searchUsers,
  setTrustedCreatorFlag,
  setUserRole,
} from '@/services/admin';
import type { AdminUserSummary, Profile, RestrictionType, UserRole } from '@/types';
import { wrapAdminPage } from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';
import { isAdmin, roleLabel } from '@/utils/permissions';
import '@/components/ListPager/ListPager.css';
import { iconSpan } from '@/utils/icon';

const USERS_PAGE_SIZE = 20;

export async function renderAdminUsers(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');

  const toolbar = document.createElement('div');
  toolbar.className = 'admin-toolbar';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search gamertag…';
  searchInput.autocomplete = 'off';
  const searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'pill-btn pill-btn--filled interactive';
  searchBtn.textContent = 'Search';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'pill-btn pill-btn--outline interactive';
  clearBtn.textContent = 'Show all';
  toolbar.append(searchInput, searchBtn, clearBtn);

  const listWrap = document.createElement('div');
  listWrap.className = 'list-pager admin-user-list';

  const results = document.createElement('div');
  results.className = 'admin-user-results list-pager__list';

  const pager = document.createElement('nav');
  pager.className = 'list-pager__controls admin-user-list__pager';
  pager.setAttribute('aria-label', 'User list pages');
  pager.hidden = true;

  const pagerSummary = document.createElement('p');
  pagerSummary.className = 'admin-user-list__summary admin-meta';

  listWrap.append(pagerSummary, results, pager);
  content.append(toolbar, listWrap);

  let currentPage = 0;
  let total = 0;
  let loading = false;

  function totalPages(): number {
    return Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  }

  function renderPager(): void {
    pager.replaceChildren();
    if (total <= USERS_PAGE_SIZE) {
      pager.hidden = true;
      return;
    }

    pager.hidden = false;
    const pages = totalPages();
    const safePage = Math.min(currentPage, pages - 1);
    currentPage = safePage;

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'list-pager__btn interactive';
    prev.disabled = safePage <= 0 || loading;
    prev.innerHTML = iconSpan('chevron-left');
    prev.setAttribute('aria-label', 'Previous page');
    prev.addEventListener('click', () => {
      currentPage = Math.max(0, currentPage - 1);
      void runSearch();
    });

    const label = document.createElement('span');
    label.className = 'list-pager__label';
    label.textContent = `Page ${safePage + 1} of ${pages}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'list-pager__btn interactive';
    next.disabled = safePage >= pages - 1 || loading;
    next.innerHTML = iconSpan('chevron-right');
    next.setAttribute('aria-label', 'Next page');
    next.addEventListener('click', () => {
      currentPage = Math.min(totalPages() - 1, currentPage + 1);
      void runSearch();
    });

    pager.append(prev, label, next);
  }

  function updateSummary(): void {
    if (total === 0) {
      pagerSummary.textContent = searchInput.value.trim()
        ? 'No users match your search.'
        : 'No users yet.';
      return;
    }

    const start = currentPage * USERS_PAGE_SIZE + 1;
    const end = Math.min(total, (currentPage + 1) * USERS_PAGE_SIZE);
    const q = searchInput.value.trim();
    const range = `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`;
    pagerSummary.textContent = q
      ? `${range} matching “${q}”`
      : `${range} users · newest first`;
  }

  async function runSearch(resetPage = false): Promise<void> {
    if (loading) return;
    if (resetPage) currentPage = 0;

    loading = true;
    searchBtn.disabled = true;
    clearBtn.disabled = true;
    results.replaceChildren();
    results.innerHTML = '<p class="admin-meta">Loading users…</p>';

    try {
      const q = searchInput.value.trim();
      const { items, total: count } = await searchUsers(
        q,
        USERS_PAGE_SIZE,
        currentPage * USERS_PAGE_SIZE,
      );
      total = count;
      currentPage = Math.min(currentPage, totalPages() - 1);

      results.replaceChildren();
      if (!items.length) {
        results.innerHTML = '<p class="admin-meta">No users found.</p>';
      } else {
        for (const u of items) {
          results.appendChild(renderUserCard(u, profile));
        }
      }

      updateSummary();
      renderPager();
    } catch (err) {
      total = 0;
      pager.hidden = true;
      pagerSummary.textContent = '';
      results.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Search failed.')}</p>`;
    } finally {
      loading = false;
      searchBtn.disabled = false;
      clearBtn.disabled = false;
    }
  }

  searchBtn.addEventListener('click', () => void runSearch(true));
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    void runSearch(true);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void runSearch(true);
  });

  container.replaceChildren(wrapAdminPage(profile, 'Users', content));
  await runSearch(true);
}

function renderUserCard(user: AdminUserSummary, staff: Profile): HTMLElement {
  const card = document.createElement('div');
  card.className = 'admin-panel';

  const title = document.createElement('h2');
  title.textContent = user.username || '(no gamertag)';

  const meta = document.createElement('p');
  meta.className = 'admin-meta';
  meta.textContent = `${roleLabel(user.role)} · ${user.mii_count} Miis · ${user.report_count} reports · joined ${new Date(user.created_at).toLocaleDateString()}`;

  card.append(title, meta);

  if (user.active_restrictions?.length) {
    const list = document.createElement('ul');
    list.className = 'admin-meta';
    for (const r of user.active_restrictions) {
      const li = document.createElement('li');
      li.textContent = `${r.restriction_type}${r.expires_at ? ` until ${new Date(r.expires_at).toLocaleString()}` : ''}`;
      const lift = document.createElement('button');
      lift.type = 'button';
      lift.className = 'pill-btn pill-btn--outline interactive';
      lift.textContent = 'Lift';
      lift.style.marginLeft = '0.5rem';
      lift.addEventListener('click', () => {
        void liftRestriction(r.id)
          .then(() => window.location.reload())
          .catch((e) => alert(e instanceof Error ? e.message : 'Failed'));
      });
      li.appendChild(lift);
      list.appendChild(li);
    }
    card.appendChild(list);
  }

  const actions = document.createElement('div');
  actions.className = 'admin-toolbar';

  if (isAdmin(staff)) {
    const roleSelect = createCustomSelect({
      ariaLabel: 'User role',
      variant: 'default',
      value: user.role,
      options: (['user', 'moderator', 'admin'] as UserRole[]).map((r) => ({
        value: r,
        label: roleLabel(r),
      })),
    });
    const roleBtn = document.createElement('button');
    roleBtn.type = 'button';
    roleBtn.className = 'pill-btn pill-btn--outline interactive';
    roleBtn.textContent = 'Set role';
    roleBtn.addEventListener('click', () => {
      void setUserRole(user.id, roleSelect.getValue() as UserRole)
        .then(() => window.location.reload())
        .catch((e) => alert(e instanceof Error ? e.message : 'Failed'));
    });
    actions.append(roleSelect.root, roleBtn);
  }

  const restrictSelect = createCustomSelect({
    ariaLabel: 'Restriction type',
    variant: 'default',
    options: (
      ['upload_ban', 'comment_ban', 'shadow', 'full_suspend'] as RestrictionType[]
    ).map((t) => ({
      value: t,
      label: t.replace('_', ' '),
    })),
  });
  const restrictBtn = document.createElement('button');
  restrictBtn.type = 'button';
  restrictBtn.className = 'pill-btn pill-btn--outline interactive';
  restrictBtn.textContent = 'Apply restriction';
  restrictBtn.addEventListener('click', () => {
    const reason = prompt('Reason for restriction?') ?? '';
    void applyRestriction(
      user.id,
      restrictSelect.getValue() as RestrictionType,
      null,
      reason,
    )
      .then(() => window.location.reload())
      .catch((e) => alert(e instanceof Error ? e.message : 'Failed'));
  });
  actions.append(restrictSelect.root, restrictBtn);

  if (isAdmin(staff)) {
    const trustedBtn = document.createElement('button');
    trustedBtn.type = 'button';
    trustedBtn.className = 'pill-btn pill-btn--outline interactive';
    trustedBtn.textContent = 'Toggle trusted creator';
    trustedBtn.addEventListener('click', () => {
      void setTrustedCreatorFlag(user.id, true)
        .then(() => window.location.reload())
        .catch((e) => alert(e instanceof Error ? e.message : 'Failed'));
    });
    actions.appendChild(trustedBtn);
  }

  card.appendChild(actions);
  return card;
}
