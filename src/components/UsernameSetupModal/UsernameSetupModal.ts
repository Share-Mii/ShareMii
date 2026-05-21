import './UsernameSetupModal.css';
import '@/components/shared.css';
import { getAuthSession } from '@/services/auth';
import {
  cacheProfileUsername,
  ensureProfile,
  updateProfile,
} from '@/services/profile';
import { validateGamertag } from '@/utils/gamertag';

let openInstance: (() => void) | null = null;

export interface UsernameSetupOptions {
  blocking?: boolean;
  onComplete?: () => void;
}

export function openUsernameSetupModal(
  options: UsernameSetupOptions = {},
): () => void {
  const { blocking = true, onComplete } = options;

  if (openInstance) {
    openInstance();
    openInstance = null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'username-setup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'username-setup-title');

  const modal = document.createElement('div');
  modal.className = 'username-setup-modal';

  const title = document.createElement('h2');
  title.id = 'username-setup-title';
  title.className = 'username-setup-modal__title';
  title.textContent = 'Choose your gamertag';

  const subtitle = document.createElement('p');
  subtitle.className = 'username-setup-modal__subtitle';
  subtitle.textContent =
    'Pick a name for your profile (3–15 characters, Xbox style: letters, numbers, and spaces).';

  const form = document.createElement('form');

  const label = document.createElement('label');
  label.className = 'username-setup-modal__label';
  label.htmlFor = 'username-setup-input';
  label.textContent = 'Gamertag';

  const input = document.createElement('input');
  input.id = 'username-setup-input';
  input.className = 'username-setup-modal__input';
  input.name = 'username';
  input.required = true;
  input.maxLength = 15;
  input.autocomplete = 'username';
  input.placeholder = 'e.g. Mii Plaza';

  const hint = document.createElement('p');
  hint.className = 'username-setup-modal__hint';

  const errorEl = document.createElement('p');
  errorEl.className = 'username-setup-modal__error';
  errorEl.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'username-setup-modal__actions';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'pill-btn pill-btn--filled interactive';
  submitBtn.textContent = 'Save gamertag';

  actions.appendChild(submitBtn);
  form.append(label, input, hint, errorEl, actions);
  modal.append(title, subtitle, form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function updateHint(): void {
    const result = validateGamertag(input.value);
    if (!input.value.trim()) {
      hint.textContent =
        'Letters, numbers, spaces; must start with a letter; 3–15 chars.';
      hint.classList.remove('username-setup-modal__hint--error');
      return;
    }
    if (result.ok) {
      hint.textContent = 'Looks good!';
      hint.classList.remove('username-setup-modal__hint--error');
    } else {
      hint.textContent = result.error ?? '';
      hint.classList.add('username-setup-modal__hint--error');
    }
  }

  input.addEventListener('input', updateHint);
  updateHint();

  if (!blocking) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  function close(): void {
    overlay.remove();
    openInstance = null;
  }

  openInstance = close;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const validation = validateGamertag(input.value);
    if (!validation.ok) {
      errorEl.textContent = validation.error ?? 'Invalid gamertag';
      errorEl.hidden = false;
      return;
    }

    const session = await getAuthSession();
    if (!session?.user) {
      errorEl.textContent = 'You must be logged in.';
      errorEl.hidden = false;
      return;
    }

    submitBtn.setAttribute('disabled', 'true');

    try {
      await ensureProfile(session.user.id);
      const profile = await updateProfile(session.user.id, {
        username: input.value.trim(),
      });
      cacheProfileUsername(session.user.id, profile.username);
      close();
      onComplete?.();
    } catch (err) {
      errorEl.textContent =
        err instanceof Error ? err.message : 'Could not save gamertag.';
      errorEl.hidden = false;
      submitBtn.removeAttribute('disabled');
    }
  });

  void input.focus();
  return close;
}

export function isUsernameSetupOpen(): boolean {
  return openInstance !== null;
}
