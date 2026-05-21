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
  toolbar.append(searchInput, searchBtn);

  const results = document.createElement('div');
  results.className = 'admin-user-results';
  content.append(toolbar, results);

  async function runSearch(): Promise<void> {
    const q = searchInput.value.trim();
    if (!q) return;
    results.replaceChildren();
    try {
      const users = await searchUsers(q);
      if (!users.length) {
        results.innerHTML = '<p class="admin-meta">No users found.</p>';
        return;
      }
      for (const u of users) {
        results.appendChild(renderUserCard(u, profile));
      }
    } catch (err) {
      results.innerHTML = `<p class="page-error">${escapeHtml(err instanceof Error ? err.message : 'Search failed.')}</p>`;
    }
  }

  searchBtn.addEventListener('click', () => void runSearch());
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void runSearch();
  });

  container.replaceChildren(wrapAdminPage(profile, 'Users', content));
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
