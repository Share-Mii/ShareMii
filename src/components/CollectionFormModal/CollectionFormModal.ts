import './CollectionFormModal.css';
import '@/components/shared.css';
import type { MiiCollection } from '@/services/social';
import {
  createCollection,
  updateCollection,
  type CollectionFormInput,
} from '@/services/social';
import { logProfileContentPolicyAttempt } from '@/services/supabase';
import { moderationFailReasonForUserText } from '@/utils/contentModeration';
import { icon } from '@/utils/icon';

export interface OpenCollectionFormModalOptions {
  userId: string;
  collection?: MiiCollection;
  onSaved?: (collection: MiiCollection) => void;
}

export function openCollectionFormModal(
  options: OpenCollectionFormModalOptions,
): () => void {
  const editing = Boolean(options.collection);

  const overlay = document.createElement('div');
  overlay.className = 'collection-form-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'collection-form-modal';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className =
    'pill-btn pill-btn--outline interactive collection-form-modal__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('xmark');

  const title = document.createElement('h2');
  title.className = 'collection-form-modal__title';
  title.textContent = editing ? 'Edit collection' : 'New collection';

  const hint = document.createElement('p');
  hint.className = 'collection-form-modal__hint';
  hint.textContent = editing
    ? 'Update your collection name, description, or visibility.'
    : 'Group Miis into a curated list. Turn on Public to share it with anyone.';

  const form = document.createElement('form');

  const nameGroup = document.createElement('div');
  nameGroup.className = 'collection-form-modal__field';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'collection-form-modal__label';
  nameLabel.htmlFor = 'collection-name';
  nameLabel.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.id = 'collection-name';
  nameInput.type = 'text';
  nameInput.required = true;
  nameInput.maxLength = 80;
  nameInput.value = options.collection?.name ?? '';
  nameInput.placeholder = 'e.g. Best villains';
  nameGroup.append(nameLabel, nameInput);

  
  const descGroup = document.createElement('div');
  descGroup.className = 'collection-form-modal__field';
  const descLabel = document.createElement('label');
  descLabel.className = 'collection-form-modal__label';
  descLabel.htmlFor = 'collection-desc';
  descLabel.textContent = 'Description (optional)';
  const descInput = document.createElement('textarea');
  descInput.id = 'collection-desc';
  descInput.rows = 3;
  descInput.maxLength = 300;
  descInput.value = options.collection?.description ?? '';
  descInput.placeholder = 'What is this collection about?';
  descGroup.append(descLabel, descInput);

  const publicToggle = document.createElement('input');
  publicToggle.type = 'checkbox';
  publicToggle.id = 'collection-public';
  publicToggle.className = 'collection-form-modal__public-input';
  publicToggle.checked = options.collection?.is_public ?? false;

  const publicRow = document.createElement('label');
  publicRow.className = 'collection-form-modal__public-toggle';
  publicRow.htmlFor = 'collection-public';

  const publicText = document.createElement('div');
  publicText.className = 'collection-form-modal__public-copy';
  const publicLabel = document.createElement('span');
  publicLabel.className = 'collection-form-modal__public-label';
  publicLabel.textContent = 'Public';
  const publicHint = document.createElement('span');
  publicHint.className = 'collection-form-modal__public-hint';
  publicHint.textContent = 'Anyone with the link can view this collection.';
  publicText.append(publicLabel, publicHint);

  const publicSwitch = document.createElement('span');
  publicSwitch.className = 'collection-form-modal__public-switch';
  publicSwitch.setAttribute('aria-hidden', 'true');

  publicRow.append(publicText, publicToggle, publicSwitch);

  const errorEl = document.createElement('p');
  errorEl.className = 'collection-form-modal__error';
  errorEl.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'collection-form-modal__actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pill-btn pill-btn--outline interactive';
  cancelBtn.textContent = 'Cancel';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'pill-btn pill-btn--filled interactive';
  submitBtn.textContent = editing ? 'Save changes' : 'Create collection';

  actions.append(cancelBtn, submitBtn);
  form.append(nameGroup, descGroup, publicRow, errorEl, actions);
  modal.append(closeBtn, title, hint, form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = (): void => overlay.remove();

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;

    const input: CollectionFormInput = {
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      isPublic: publicToggle.checked,
    };

    if (!input.name) {
      errorEl.textContent = 'Name is required.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      return;
    }

    const nameBlocked = await moderationFailReasonForUserText(input.name);
    if (nameBlocked) {
      errorEl.textContent = nameBlocked;
      errorEl.hidden = false;
      void logProfileContentPolicyAttempt(
        'collection_name',
        input.name,
        nameBlocked,
      );
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      return;
    }

    const descBlocked = await moderationFailReasonForUserText(
      input.description ?? '',
    );
    if (descBlocked) {
      errorEl.textContent = descBlocked;
      errorEl.hidden = false;
      void logProfileContentPolicyAttempt(
        'collection_description',
        input.description ?? '',
        descBlocked,
      );
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      return;
    }

    try {
      const saved = editing
        ? await updateCollection(options.collection!.id, input)
        : await createCollection(options.userId, input);
      options.onSaved?.(saved);
      close();
    } catch (err) {
      errorEl.textContent =
        err instanceof Error ? err.message : 'Could not save collection.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });

  nameInput.focus();
  return close;
}
