import './SubmitModal.css';
import { navigateTo } from '@/utils/navigation';
import '@/components/shared.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { openUsernameSetupModal } from '@/components/UsernameSetupModal/UsernameSetupModal';
import { getAuthSession } from '@/services/auth';
import { navigateToUploadedMii } from '@/services/miiUploadNavigate';
import {
  fetchProfileById,
  hasCompletedProfile,
} from '@/services/profile';
import {
  logProfileContentPolicyAttempt,
  insertMii,
  updateMii,
} from '@/services/supabase';
import { icon, iconSpan } from '@/utils/icon';
import type { ContentVisibility, DecodedQrMii, Mii, Platform } from '@/types';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'wii', label: 'Wii' },
  { value: '3ds', label: '3DS' },
  { value: 'wiiu', label: 'Wii U' },
  { value: 'switch', label: 'Switch' },
];

import { MII_NAME_MAX, truncateMiiName, validateMiiName } from '@/utils/miiName';
import { moderationFailReasonForUserText } from '@/utils/contentModeration';

const DESC_MAX = 500;

export interface SubmitModalCallbacks {
  onSuccess?: (miiId: string) => void;
  onCancel?: () => void;
}

export interface SubmitModalOptions {
  editMii?: Mii;
  remixOfMiiId?: string;
}

let activeTeardown: (() => void) | null = null;
let openGeneration = 0;

function removeAllSubmitOverlays(): void {
  document.querySelectorAll('.submit-modal-overlay').forEach((el) => el.remove());
  activeTeardown = null;
}

export function closeSubmitModal(): void {
  activeTeardown?.();
  removeAllSubmitOverlays();
}

export function openSubmitModal(
  decoded: DecodedQrMii,
  callbacks: SubmitModalCallbacks = {},
  options: SubmitModalOptions = {},
): () => void {
  closeSubmitModal();
  const generation = ++openGeneration;

  let closeModal: () => void = () => {};

  void (async () => {
    const session = await getAuthSession();
    if (generation !== openGeneration) return;

    if (!session?.user) {
      callbacks.onCancel?.();
      return;
    }

    const profile = await fetchProfileById(session.user.id);
    if (generation !== openGeneration) return;

    if (!hasCompletedProfile(profile)) {
      openUsernameSetupModal({
        blocking: true,
        onComplete: () => {
          openSubmitModal(decoded, callbacks, options);
        },
      });
      return;
    }

    closeModal = buildModal(
      decoded,
      callbacks,
      session.user.id,
      options,
    );
    activeTeardown = closeModal;
  })();

  return () => {
    closeModal();
    if (activeTeardown === closeModal) {
      activeTeardown = null;
    }
    removeAllSubmitOverlays();
  };
}

function buildModal(
  decoded: DecodedQrMii,
  callbacks: SubmitModalCallbacks,
  userId: string,
  options: SubmitModalOptions,
): () => void {
  const editMii = options.editMii;
  const isEdit = Boolean(editMii);

  let selectedPlatform: Platform =
    editMii?.platform ??
    decoded.suggestedPlatform ??
    (decoded.isTomodachiLife ? '3ds' : '3ds');

  const overlay = document.createElement('div');
  overlay.className = 'submit-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'submit-modal-title');

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
  title.id = 'submit-modal-title';
  title.className = 'submit-modal__title';
  title.textContent = isEdit ? 'Save changes' : 'Share your Mii';

  const subtitle = document.createElement('p');
  subtitle.className = 'submit-modal__subtitle';
  subtitle.textContent = isEdit
    ? 'Confirm the name, platform, and description for your updated Mii.'
    : 'Check the preview, add a name, and pick where this Mii came from.';

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
      miiData: decoded.miiDataBase64,
      width: 280,
      alt: 'Mii preview',
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
  nameInput.value = truncateMiiName(
    decoded.name ?? editMii?.name ?? '',
  );

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

  let selectedVisibility: ContentVisibility =
    editMii?.visibility === 'hidden' ? 'hidden' : 'public';

  const visibilityField = document.createElement('div');
  visibilityField.className = 'submit-modal__field submit-modal__field--visibility';

  const visibilityLabel = document.createElement('span');
  visibilityLabel.className = 'submit-modal__label';
  visibilityLabel.textContent = 'Who can see this?';

  const visibilityWrap = document.createElement('div');
  visibilityWrap.className = 'submit-modal__platforms';

  const visibilityButtons: HTMLButtonElement[] = [];
  for (const opt of [
    { value: 'public' as const, label: 'Public' },
    { value: 'hidden' as const, label: 'Draft (only you)' },
  ]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `submit-modal__platform-btn interactive${opt.value === selectedVisibility ? ' submit-modal__platform-btn--active' : ''}`;
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      selectedVisibility = opt.value;
      visibilityButtons.forEach((el) => {
        el.classList.toggle('submit-modal__platform-btn--active', el === btn);
      });
    });
    visibilityButtons.push(btn);
    visibilityWrap.appendChild(btn);
  }

  visibilityField.append(visibilityLabel, visibilityWrap);

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
  descInput.value = editMii?.description ?? '';

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

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'submit-modal__cancel interactive';
  cancelBtn.textContent = 'Cancel';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'submit-modal__submit interactive';
  submitBtn.innerHTML = isEdit
    ? `${iconSpan('floppy-disk')} Save changes`
    : `${iconSpan('cloud-arrow-up')} Share Mii`;

  actions.append(cancelBtn, submitBtn);
  form.append(
    nameField,
    platformField,
    visibilityField,
    descField,
    errorEl,
    statusEl,
    actions,
  );
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
    closeBtn.disabled = on;
    nameInput.disabled = on;
    descInput.disabled = on;
    platformButtons.forEach((btn) => {
      btn.disabled = on;
    });
    visibilityButtons.forEach((btn) => {
      btn.disabled = on;
    });
    if (on) {
      const label =
        phase === 'checking'
          ? 'Checking your details…'
          : isEdit
            ? 'Saving your Mii…'
            : 'Sharing your Mii…';
      statusEl.textContent = label;
      statusEl.hidden = false;
      submitBtn.innerHTML = `${iconSpan('spinner')} ${phase === 'checking' ? 'Checking…' : isEdit ? 'Saving…' : 'Sharing…'}`;
    } else {
      statusEl.hidden = true;
      statusEl.textContent = '';
      submitBtn.innerHTML = isEdit
        ? `${iconSpan('floppy-disk')} Save changes`
        : `${iconSpan('cloud-arrow-up')} Share Mii`;
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
      if (isEdit && editMii) {
        const mii = await updateMii(editMii.id, {
          name,
          description,
          platform: selectedPlatform,
          gender: decoded.gender ?? editMii.gender ?? null,
          mii_data: decoded.miiDataBase64,
          mii_data_download: decoded.miiDataDownloadBase64 ?? null,
          visibility: selectedVisibility,
        });

        dismiss();
        callbacks.onSuccess?.(mii.id);
        navigateTo(`/mii/${mii.id}`);
      } else {
        const mii = await insertMii({
          name,
          description,
          platform: selectedPlatform,
          gender: decoded.gender ?? null,
          mii_data: decoded.miiDataBase64,
          mii_data_download: decoded.miiDataDownloadBase64 ?? null,
          visibility: selectedVisibility,
          user_id: userId,
          remix_of_mii_id: options.remixOfMiiId ?? null,
        });

        dismiss();
        callbacks.onSuccess?.(mii.id);
        navigateToUploadedMii(mii.id);
      }
    } catch (err) {
      releaseSubmitLock();
      errorEl.textContent =
        err instanceof Error && err.message
          ? err.message
          : isEdit
            ? 'Could not save changes. Check your connection and try again.'
            : 'Could not share your Mii. Check your connection and try again.';
      errorEl.hidden = false;
    }
  });

  requestAnimationFrame(() => nameInput.focus());

  return dismiss;
}
