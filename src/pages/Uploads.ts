import './pages.css';
import { navigateTo } from '@/utils/navigation';
import './Uploads.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import type { PaginatedListHandle } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { openMiiEditModal } from '@/components/MiiEditModal/MiiEditModal';
import { createTileOverflowMenu } from '@/components/TileOverflowMenu/TileOverflowMenu';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { deleteMii, fetchMiisByUserId, isSupabaseConfigured } from '@/services/supabase';
import { navigateToMiiMakerEdit } from '@/services/miiMakerNavigate';
import { confirmDeleteMii } from '@/utils/miiDeleteConfirm';
import { createMiiTileCornerOverflowOnly } from '@/components/ShareActions/ShareActions';
import type { Mii } from '@/types';

export function renderUploads(container: HTMLElement): () => void {
  let abort = false;
  let paginated: PaginatedListHandle<Mii> | null = null;
  let miis: Mii[] = [];
  let bulkMode = false;
  const selected = new Set<string>();

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top uploads-page';
  page.innerHTML = '<p class="page-loading">Loading your uploads…</p>';
  container.replaceChildren(wrapPublicPage(page));

  function renderTile(mii: Mii, i: number): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'uploads-page__item';

    if (bulkMode) {
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'uploads-page__bulk-check';
      check.checked = selected.has(mii.id);
      check.addEventListener('change', () => {
        if (check.checked) selected.add(mii.id);
        else selected.delete(mii.id);
      });
      wrap.appendChild(check);
    }

    const tile = createMiiTile(mii, i, { variant: 'grid' });
    tile.addEventListener('click', (e) => {
      if (
        (e.target as HTMLElement).closest(
          '.mii-tile__corner-actions, .tile-overflow-menu',
        )
      ) {
        e.preventDefault();
      }
    });

    const menu = createTileOverflowMenu(
      [
        {
          label: 'Edit Mii',
          onSelect: () => {
            navigateToMiiMakerEdit(mii.id);
          },
        },
        {
          label: 'Edit details',
          onSelect: () => {
            openMiiEditModal(mii, {
              onSaved: (updated) => {
                Object.assign(mii, updated);
                paginated?.setItems([...miis]);
              },
            });
          },
        },
        {
          label: 'Delete',
          danger: true,
          onSelect: () => {
            confirmDeleteMii(mii, () => {
              miis = miis.filter((m) => m.id !== mii.id);
              paginated?.setItems(miis);
              if (!miis.length) {
                void load();
              }
            });
          },
        },
      ],
      'Mii options',
    );

    wrap.append(tile, createMiiTileCornerOverflowOnly(menu));
    return wrap;
  }

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    const session = await getAuthSession();
    if (!isLoggedIn(session)) {
      openLoginModal();
      navigateTo('/');
      return;
    }

    const userId = session!.user.id;

    try {
      miis = await fetchMiisByUserId(userId);
    } catch {
      if (abort) return;
      page.innerHTML =
        '<p class="page-error">Could not load uploads. <a href="/">Go home</a></p>';
      return;
    }

    if (abort) return;

    page.replaceChildren();

    const heading = document.createElement('h1');
    heading.className = 'uploads-page__title';
    heading.textContent = 'My Uploads';

    const lead = document.createElement('p');
    lead.className = 'uploads-page__lead';
    lead.textContent = 'Edit or delete Miis you have shared.';

    const toolbar = document.createElement('div');
    toolbar.className = 'uploads-page__toolbar';

    const bulkToggle = document.createElement('button');
    bulkToggle.type = 'button';
    bulkToggle.className = 'pill-btn pill-btn--outline interactive';
    bulkToggle.textContent = 'Select multiple';
    bulkToggle.addEventListener('click', () => {
      bulkMode = !bulkMode;
      selected.clear();
      bulkToggle.textContent = bulkMode ? 'Cancel selection' : 'Select multiple';
      bulkDeleteBtn.hidden = !bulkMode;
      paginated?.setItems([...miis]);
    });

    const bulkDeleteBtn = document.createElement('button');
    bulkDeleteBtn.type = 'button';
    bulkDeleteBtn.className = 'pill-btn pill-btn--outline interactive';
    bulkDeleteBtn.textContent = 'Delete selected';
    bulkDeleteBtn.hidden = true;
    bulkDeleteBtn.addEventListener('click', () => {
      if (!selected.size) {
        alert('Select at least one Mii.');
        return;
      }
      if (!window.confirm(`Delete ${selected.size} Mii(s)?`)) return;
      const toDelete = miis.filter((m) => selected.has(m.id));
      void (async () => {
        bulkDeleteBtn.disabled = true;
        try {
          for (const m of toDelete) {
            await deleteMii(m.id);
          }
          miis = miis.filter((m) => !selected.has(m.id));
          selected.clear();
          bulkMode = false;
          bulkToggle.textContent = 'Select multiple';
          bulkDeleteBtn.hidden = true;
          if (!miis.length) void load();
          else paginated?.setItems(miis);
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Bulk delete failed');
        } finally {
          bulkDeleteBtn.disabled = false;
        }
      })();
    });

    toolbar.append(bulkToggle, bulkDeleteBtn);
    page.append(heading, lead, toolbar);

    if (!miis.length) {
      const empty = document.createElement('p');
      empty.className = 'uploads-page__empty';
      empty.innerHTML =
        'No uploads yet. <a href="/create" class="interactive">Create a Mii</a> or <a href="#" data-scan-submit class="interactive">scan a QR code</a>.';
      page.appendChild(empty);
      paginated = null;
      return;
    }

    paginated = createPaginatedList<Mii>({
      listClassName: 'uploads-page__grid list-pager__list',
      renderItem: renderTile,
    });

    paginated.setItems(miis);
    page.appendChild(paginated.root);
  }

  load();

  return () => {
    abort = true;
  };
}
