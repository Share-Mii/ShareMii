import './MiiEditModal.css';
import '@/components/shared.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { navigateToMiiMakerEdit } from '@/services/miiMakerNavigate';
import {
  logProfileContentPolicyAttempt,
  updateMii,
} from '@/services/supabase';
import { icon, iconSpan } from '@/utils/icon';
import type { Mii, Platform } from '@/types';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'wii', label: 'Wii' },
  { value: '3ds', label: '3DS' },
  { value: 'wiiu', label: 'Wii U' },
  { value: 'switch', label: 'Switch' },
];

import { MII_NAME_MAX, truncateMiiName, validateMiiName } from '@/utils/miiName';
import { moderationFailReasonForUserText } from '@/utils/contentModeration';

const DESC_MAX = 500;

export interface MiiEditModalCallbacks {
  onSaved?: (mii: Mii) => void;
  onCancel?: () => void;
}

let activeTeardown: (() => void) | null = null;

function removeOverlays(): void {
  document.querySelectorAll('.mii-edit-modal-overlay').forEach((el) => el.remove());
  activeTeardown = null;
}

export function closeMiiEditModal(): void {
  activeTeardown?.();
  removeOverlays();
}

export function openMiiEditModal(
  mii: Mii,
  callbacks: MiiEditModalCallbacks = {},
): () => void {
  closeMiiEditModal();
  const dismiss = buildModal(mii, callbacks);
  activeTeardown = dismiss;
  return dismiss;
}

function buildModal(
  mii: Mii,
  callbacks: MiiEditModalCallbacks,
): () => void {
  let selectedPlatform: Platform = mii.platform;

  const overlay = document.createElement('div');
  overlay.className = 'mii-edit-modal-overlay submit-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'mii-edit-modal-title');

  const modal = document.createElement('div');
  modal.className = 'submit-modal';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'submit-modal__close interactive';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('xmark');

  const header = document.createElement('header');
  header.className = 'submit-modal__header';

  const title = document.createElement('h2');
  title.id = 'mii-edit-modal-title';
  title.className = 'submit-modal__title';
  title.textContent = 'Edit Mii';

  const subtitle = document.createElement('p');
  subtitle.className = 'submit-modal__subtitle';
  subtitle.textContent =
    'Update the name, platform, or description — or edit appearance in the Mii Maker.';

  header.append(title, subtitle);

  const body = document.createElement('div');
  body.className = 'submit-modal__body';

  const previewCol = document.createElement('div');
  previewCol.className = 'submit-modal__preview-col';

  const previewLabel = document.createElement('span');
  previewLabel.className = 'submit-modal__preview-label';
  previewLabel.textContent = 'Preview';

  const preview = document.createElement('div');
  preview.className = 'submit-modal__preview';
  preview.appendChild(
    createMiiRenderer({
      miiData: mii.mii_data,
      width: 280,
      alt: mii.name,
      platform: selectedPlatform,
    }),
  );

  previewCol.append(previewLabel, preview);

  const formCol = document.createElement('div');
  formCol.className = 'submit-modal__form-col';

  const form = document.createElement('form');
  form.className = 'submit-modal__form';
  form.noValidate = true;

  const errorEl = document.createElement('p');
  errorEl.className = 'submit-modal__error';
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;

  const statusEl = document.createElement('p');
  statusEl.className = 'submit-modal__status';
  statusEl.hidden = true;
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');

  const nameField = document.createElement('div');
  nameField.className = 'submit-modal__field';

  const nameLabelRow = document.createElement('div');
  nameLabelRow.className = 'submit-modal__label-row';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'submit-modal__label';
  nameLabel.htmlFor = 'mii-name';
  nameLabel.textContent = 'Mii name';

  const nameCount = document.createElement('span');
  nameCount.className = 'submit-modal__hint';
  nameCount.setAttribute('aria-live', 'polite');

  const nameInput = document.createElement('input');
  nameInput.className = 'submit-modal__input';
  nameInput.id = 'mii-name';
  nameInput.name = 'name';
  nameInput.required = true;
  nameInput.maxLength = MII_NAME_MAX;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'e.g. Mario';
  nameInput.value = mii.name;

  function updateNameCount(): void {
    const len = nameInput.value.length;
    nameCount.textContent = `${len}/${MII_NAME_MAX}`;
    nameCount.classList.toggle('submit-modal__hint--limit', len >= MII_NAME_MAX);
  }
  updateNameCount();
  nameInput.addEventListener('input', updateNameCount);

  nameLabelRow.append(nameLabel, nameCount);
  nameField.append(nameLabelRow, nameInput);

  const platformField = document.createElement('div');
  platformField.className = 'submit-modal__field';

  const platformLabel = document.createElement('span');
  platformLabel.className = 'submit-modal__label';
  platformLabel.id = 'mii-platform-label';
  platformLabel.textContent = 'Original platform';

  const platformsWrap = document.createElement('div');
  platformsWrap.className = 'submit-modal__platforms';
  platformsWrap.setAttribute('role', 'group');
  platformsWrap.setAttribute('aria-labelledby', 'mii-platform-label');

  const platformButtons: HTMLButtonElement[] = [];
  for (const p of PLATFORMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `submit-modal__platform-btn interactive${p.value === selectedPlatform ? ' submit-modal__platform-btn--active' : ''}`;
    btn.textContent = p.label;
    btn.setAttribute('aria-pressed', String(p.value === selectedPlatform));
    btn.addEventListener('click', () => {
      selectedPlatform = p.value;
      platformButtons.forEach((el) => {
        const active = el === btn;
        el.classList.toggle('submit-modal__platform-btn--active', active);
        el.setAttribute('aria-pressed', String(active));
      });
    });
    platformButtons.push(btn);
    platformsWrap.appendChild(btn);
  }

  platformField.append(platformLabel, platformsWrap);

  const descField = document.createElement('div');
  descField.className = 'submit-modal__field';

  const descLabelRow = document.createElement('div');
  descLabelRow.className = 'submit-modal__label-row';

  const descLabel = document.createElement('label');
  descLabel.className = 'submit-modal__label';
  descLabel.htmlFor = 'mii-desc';
  descLabel.textContent = 'Description';

  const descOptional = document.createElement('span');
  descOptional.className = 'submit-modal__hint';
  descOptional.textContent = 'Optional';

  const descCount = document.createElement('span');
  descCount.className = 'submit-modal__hint';
  descCount.setAttribute('aria-live', 'polite');

  const descInput = document.createElement('textarea');
  descInput.className = 'submit-modal__input submit-modal__textarea';
  descInput.id = 'mii-desc';
  descInput.name = 'description';
  descInput.maxLength = DESC_MAX;
  descInput.rows = 3;
  descInput.placeholder = 'Where did you find them? Any fun details?';
  descInput.value = mii.description;

  function updateDescCount(): void {
    const len = descInput.value.length;
    descCount.textContent = `${len}/${DESC_MAX}`;
    descCount.classList.toggle('submit-modal__hint--limit', len >= DESC_MAX);
  }
  updateDescCount();
  descInput.addEventListener('input', updateDescCount);

  descLabelRow.append(descLabel, descOptional, descCount);
  descField.append(descLabelRow, descInput);

  const actions = document.createElement('div');
  actions.className = 'submit-modal__actions';

  const makerBtn = document.createElement('button');
  makerBtn.type = 'button';
  makerBtn.className = 'pill-btn pill-btn--outline interactive submit-modal__maker-link';
  makerBtn.innerHTML = `${iconSpan('pen')} Edit Mii`;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'submit-modal__cancel interactive';
  cancelBtn.textContent = 'Cancel';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'submit-modal__submit interactive';
  submitBtn.innerHTML = `${iconSpan('floppy-disk')} Save details`;

  actions.append(makerBtn, cancelBtn, submitBtn);
  form.append(nameField, platformField, descField, errorEl, statusEl, actions);
  formCol.appendChild(form);
  body.append(previewCol, formCol);

  modal.append(closeBtn, header, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let closed = false;
  let submitting = false;

  function setSubmittingUi(
    on: boolean,
    phase: 'checking' | 'saving' = 'saving',
  ): void {
    overlay.classList.toggle('submit-modal-overlay--submitting', on);
    modal.classList.toggle('submit-modal--busy', on);
    submitBtn.disabled = on;
    submitBtn.setAttribute('aria-busy', String(on));
    cancelBtn.disabled = on;
    makerBtn.disabled = on;
    closeBtn.disabled = on;
    nameInput.disabled = on;
    descInput.disabled = on;
    platformButtons.forEach((btn) => {
      btn.disabled = on;
    });
    if (on) {
      statusEl.textContent =
        phase === 'checking' ? 'Checking your details…' : 'Saving your Mii…';
      statusEl.hidden = false;
      submitBtn.innerHTML = `${iconSpan('spinner')} ${phase === 'checking' ? 'Checking…' : 'Saving…'}`;
    } else {
      statusEl.hidden = true;
      statusEl.textContent = '';
      submitBtn.innerHTML = `${iconSpan('floppy-disk')} Save details`;
    }
  }

  function releaseSubmitLock(): void {
    if (closed) return;
    submitting = false;
    setSubmittingUi(false);
  }

  function dismiss(): void {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    if (activeTeardown === dismiss) {
      activeTeardown = null;
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !submitting) {
      dismiss();
      callbacks.onCancel?.();
    }
  }

  document.addEventListener('keydown', onKeydown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !submitting) {
      dismiss();
      callbacks.onCancel?.();
    }
  });

  makerBtn.addEventListener('click', () => {
    if (submitting) return;
    dismiss();
    callbacks.onCancel?.();
    navigateToMiiMakerEdit(mii.id);
  });

  closeBtn.addEventListener('click', () => {
    if (submitting) return;
    dismiss();
    callbacks.onCancel?.();
  });

  cancelBtn.addEventListener('click', () => {
    if (submitting) return;
    dismiss();
    callbacks.onCancel?.();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting || closed) return;

    submitting = true;
    setSubmittingUi(true, 'checking');
    errorEl.hidden = true;

    const name = truncateMiiName(nameInput.value);
    const description = descInput.value.trim();

    const nameValidation = validateMiiName(name);
    if (!nameValidation.ok) {
      errorEl.textContent = nameValidation.error ?? 'Invalid Mii name.';
      errorEl.hidden = false;
      nameInput.focus();
      releaseSubmitLock();
      return;
    }

    const nameBlocked = await moderationFailReasonForUserText(name);
    if (nameBlocked) {
      errorEl.textContent = nameBlocked;
      errorEl.hidden = false;
      void logProfileContentPolicyAttempt('mii_name', name, nameBlocked);
      nameInput.focus();
      releaseSubmitLock();
      return;
    }

    const descriptionBlocked = await moderationFailReasonForUserText(description);
    if (descriptionBlocked) {
      errorEl.textContent = descriptionBlocked;
      errorEl.hidden = false;
      void logProfileContentPolicyAttempt('mii_description', description, descriptionBlocked);
      descInput.focus();
      releaseSubmitLock();
      return;
    }

    setSubmittingUi(true, 'saving');

    try {
      const updated = await updateMii(mii.id, {
        name,
        description,
        platform: selectedPlatform,
      });

      dismiss();
      callbacks.onSaved?.(updated);
    } catch (err) {
      releaseSubmitLock();
      errorEl.textContent =
        err instanceof Error && err.message
          ? err.message
          : 'Could not save changes. Try again.';
      errorEl.hidden = false;
    }
  });

  requestAnimationFrame(() => nameInput.focus());

  return dismiss;
}

