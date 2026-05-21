import './AddToCollectionModal.css';
import '@/components/shared.css';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { openCollectionFormModal } from '@/components/CollectionFormModal/CollectionFormModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import {
  addMiiToCollection,
  fetchCollectionIdsForMii,
  fetchUserCollections,
  removeMiiFromCollection,
  type MiiCollection,
} from '@/services/social';
import { icon } from '@/utils/icon';

export interface OpenAddToCollectionModalOptions {
  miiId: string;
  onChanged?: () => void;
}

export function openAddToCollectionModal(
  options: OpenAddToCollectionModalOptions,
): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'add-collection-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'add-collection-modal';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = (): void => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  void getAuthSession().then(async (session) => {
    if (!isLoggedIn(session)) {
      close();
      openLoginModal();
      return;
    }
    await render(session!.user.id);
  });

  async function render(userId: string): Promise<void> {
    modal.replaceChildren();
    modal.innerHTML = '<p class="page-loading">Loading…</p>';

    let collections: MiiCollection[] = [];
    let inCollections = new Set<string>();
    try {
      [collections, inCollections] = await Promise.all([
        fetchUserCollections(userId),
        fetchCollectionIdsForMii(userId, options.miiId),
      ]);
    } catch {
      modal.innerHTML =
        '<p class="page-error">Could not load collections.</p>';
      return;
    }

    modal.replaceChildren();

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className =
      'pill-btn pill-btn--outline interactive add-collection-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = icon('xmark');
    closeBtn.addEventListener('click', close);

    const title = document.createElement('h2');
    title.className = 'add-collection-modal__title';
    title.textContent = 'Add to collection';

    const hint = document.createElement('p');
    hint.className = 'add-collection-modal__hint';
    hint.textContent =
      'Save this Mii to one or more of your collections.';

    const list = document.createElement('ul');
    list.className = 'add-collection-modal__list';

    if (!collections.length) {
      const empty = document.createElement('p');
      empty.className = 'add-collection-modal__empty';
      empty.textContent = 'No collections yet. Create one below.';
      list.appendChild(empty);
    }

    for (const c of collections) {
      const li = document.createElement('li');
      li.className = 'add-collection-modal__item';
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = inCollections.has(c.id);
      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;
        try {
          if (checkbox.checked) {
            await addMiiToCollection(c.id, options.miiId);
            inCollections.add(c.id);
          } else {
            await removeMiiFromCollection(c.id, options.miiId);
            inCollections.delete(c.id);
          }
          options.onChanged?.();
        } catch (err) {
          checkbox.checked = !checkbox.checked;
          alert(
            err instanceof Error ? err.message : 'Could not update collection',
          );
        } finally {
          checkbox.disabled = false;
        }
      });

      const meta = document.createElement('div');
      meta.className = 'add-collection-modal__item-meta';
      const strong = document.createElement('strong');
      strong.textContent = c.name;
      const span = document.createElement('span');
      const count = c.item_count ?? 0;
      span.textContent = `${c.is_public ? 'Public' : 'Private'} · ${count} Mii${count === 1 ? '' : 's'}`;
      meta.append(strong, span);
      label.append(checkbox, meta);
      li.appendChild(label);
      list.appendChild(li);
    }

    const footer = document.createElement('div');
    footer.className = 'add-collection-modal__footer';
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className =
      'pill-btn pill-btn--outline interactive add-collection-modal__new';
    newBtn.textContent = 'Create new collection';
    newBtn.addEventListener('click', () => {
      openCollectionFormModal({
        userId,
        onSaved: async (created) => {
          await addMiiToCollection(created.id, options.miiId);
          options.onChanged?.();
          await render(userId);
        },
      });
    });

    footer.appendChild(newBtn);
    modal.append(closeBtn, title, hint, list, footer);
  }

  return close;
}
