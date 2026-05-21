import './LoginModal.css';
import {
  resetPassword,
  signInWithPassword,
  signInWithProvider,
  signUpWithPassword,
} from '@/services/auth';
import { icon } from '@/utils/icon';

type ModalMode = 'signin' | 'signup' | 'forgot';

const GOOGLE_ICON = `<svg class="login-modal__oauth-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

const GITHUB_ICON = `<svg class="login-modal__oauth-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`;

export function openLoginModal(initialMode: ModalMode = 'signin'): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'login-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'login-modal-title');

  const modal = document.createElement('div');
  modal.className = 'login-modal';

  let mode: ModalMode = initialMode;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = (): void => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function render(): void {
    modal.className = `login-modal${mode === 'forgot' ? ' login-modal--forgot' : ''}`;
    modal.replaceChildren();

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'login-modal__close interactive';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = icon('xmark');
    closeBtn.addEventListener('click', close);
    modal.appendChild(closeBtn);

    const errorEl = document.createElement('p');
    errorEl.className = 'login-modal__error';
    errorEl.hidden = true;

    const successEl = document.createElement('p');
    successEl.className = 'login-modal__success';
    successEl.hidden = true;

    if (mode === 'forgot') {
      const title = document.createElement('h2');
      title.id = 'login-modal-title';
      title.className = 'login-modal__title';
      title.textContent = 'Reset password';

      const subtitle = document.createElement('p');
      subtitle.className = 'login-modal__subtitle';
      subtitle.textContent =
        'Enter your email and we will send you a link to reset your password.';

      modal.append(title, subtitle, errorEl, successEl);
      modal.appendChild(
        buildForgotForm(errorEl, successEl, () => {
          mode = 'signin';
          render();
        }),
      );
      return;
    }

    const sparkles = document.createElement('div');
    sparkles.className = 'login-modal__sparkles';
    sparkles.innerHTML = `${icon('star')}${icon('star')}${icon('star')}`;
    modal.appendChild(sparkles);

    const isSignup = mode === 'signup';
    const title = document.createElement('h2');
    title.id = 'login-modal-title';
    title.className = 'login-modal__title';
    title.textContent = isSignup ? 'Create your account' : 'Welcome back';

    const subtitle = document.createElement('p');
    subtitle.className = 'login-modal__subtitle';
    subtitle.textContent = isSignup
      ? 'Join ShareMii to scan, submit, yeah, and manage your Miis with the community.'
      : 'Sign in to scan, submit, yeah, and manage your Miis with the community.';

    modal.append(title, subtitle, errorEl, successEl);

    const form = document.createElement('form');
    form.className = 'login-modal__form';

    form.appendChild(buildEmailField());
    form.appendChild(
      buildPasswordField(isSignup, () => {
        mode = 'forgot';
        render();
      }),
    );
    if (isSignup) {
      form.appendChild(buildConfirmPasswordField());
    } else {
      form.appendChild(buildRememberRow());
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'login-modal__submit interactive';
    submit.innerHTML = `${isSignup ? 'Create account' : 'Sign in'} ${icon('arrow-right')}`;
    form.appendChild(submit);

    const divider = document.createElement('p');
    divider.className = 'login-modal__divider';
    divider.textContent = 'or continue with';

    const oauth = document.createElement('div');
    oauth.className = 'login-modal__oauth';
    oauth.append(
      buildOAuthButton('google', 'Google', GOOGLE_ICON, errorEl),
      buildOAuthButton('github', 'GitHub', GITHUB_ICON, errorEl),
    );

    const footer = document.createElement('p');
    footer.className = 'login-modal__footer';
    const footerLink = document.createElement('button');
    footerLink.type = 'button';
    footerLink.className = 'login-modal__footer-link';

    if (isSignup) {
      footer.append('Already have an account? ');
      footerLink.textContent = 'Sign in';
      footerLink.addEventListener('click', () => {
        mode = 'signin';
        render();
      });
    } else {
      footer.append("Don't have an account? ");
      footerLink.textContent = 'Create account';
      footerLink.addEventListener('click', () => {
        mode = 'signup';
        render();
      });
    }
    footer.appendChild(footerLink);

    modal.append(form, divider, oauth, footer);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      successEl.hidden = true;

      const fd = new FormData(form);
      const email = String(fd.get('email') ?? '').trim();
      const password = String(fd.get('password') ?? '');

      if (!email || !password) {
        errorEl.textContent = 'Please enter your email and password.';
        errorEl.hidden = false;
        return;
      }

      if (isSignup) {
        const confirm = String(fd.get('confirmPassword') ?? '');
        if (password !== confirm) {
          errorEl.textContent = 'Passwords do not match.';
          errorEl.hidden = false;
          return;
        }
        if (password.length < 6) {
          errorEl.textContent = 'Password must be at least 6 characters.';
          errorEl.hidden = false;
          return;
        }
      }

      submit.disabled = true;

      if (isSignup) {
        const { error, needsConfirmation } = await signUpWithPassword(
          email,
          password,
        );
        submit.disabled = false;
        if (error) {
          errorEl.textContent = error;
          errorEl.hidden = false;
          return;
        }
        if (needsConfirmation) {
          successEl.textContent =
            'Account created! Check your email to confirm, then sign in.';
          successEl.hidden = false;
          return;
        }
        close();
        return;
      }

      const err = await signInWithPassword(email, password);
      submit.disabled = false;
      if (err) {
        errorEl.textContent = err;
        errorEl.hidden = false;
        return;
      }
      close();
    });
  }

  render();
  return close;
}

function buildEmailField(): HTMLElement {
  const field = document.createElement('div');
  field.className = 'login-modal__field';
  field.innerHTML = `
    <label class="login-modal__label" for="login-email">Email</label>
    <div class="login-modal__input-wrap">
      <span class="login-modal__input-icon" aria-hidden="true">${icon('envelope')}</span>
      <input class="login-modal__input" id="login-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" />
    </div>
  `;
  return field;
}

function buildPasswordField(
  signup: boolean,
  onForgot: () => void,
): HTMLElement {
  const field = document.createElement('div');
  field.className = 'login-modal__field';

  const labelRow = document.createElement('div');
  labelRow.className = 'login-modal__label-row';

  const label = document.createElement('label');
  label.className = 'login-modal__label';
  label.htmlFor = 'login-password';
  label.textContent = 'Password';
  labelRow.appendChild(label);

  if (!signup) {
    const forgot = document.createElement('button');
    forgot.type = 'button';
    forgot.className = 'login-modal__forgot';
    forgot.textContent = 'Forgot password?';
    forgot.addEventListener('click', onForgot);
    labelRow.appendChild(forgot);
  }

  const wrap = document.createElement('div');
  wrap.className = 'login-modal__input-wrap';
  wrap.innerHTML = `
    <span class="login-modal__input-icon" aria-hidden="true">${icon('lock')}</span>
    <input class="login-modal__input login-modal__input--password" id="login-password" name="password" type="password" required autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="••••••••" />
  `;

  const input = wrap.querySelector<HTMLInputElement>('.login-modal__input')!;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'login-modal__toggle-pw interactive';
  toggle.setAttribute('aria-label', 'Show password');
  toggle.innerHTML = icon('eye');
  let visible = false;
  toggle.addEventListener('click', () => {
    visible = !visible;
    input.type = visible ? 'text' : 'password';
    toggle.innerHTML = icon(visible ? 'eye-slash' : 'eye');
    toggle.setAttribute(
      'aria-label',
      visible ? 'Hide password' : 'Show password',
    );
  });
  wrap.appendChild(toggle);

  field.append(labelRow, wrap);
  return field;
}

function buildConfirmPasswordField(): HTMLElement {
  const field = document.createElement('div');
  field.className = 'login-modal__field';
  field.innerHTML = `
    <label class="login-modal__label" for="login-confirm">Confirm password</label>
    <div class="login-modal__input-wrap">
      <span class="login-modal__input-icon" aria-hidden="true">${icon('lock')}</span>
      <input class="login-modal__input login-modal__input--password" id="login-confirm" name="confirmPassword" type="password" required autocomplete="new-password" placeholder="••••••••" />
    </div>
  `;
  return field;
}

function buildRememberRow(): HTMLElement {
  const label = document.createElement('label');
  label.className = 'login-modal__remember';
  label.innerHTML = `<input type="checkbox" name="remember" checked /> Remember me`;
  return label;
}

function buildForgotForm(
  errorEl: HTMLElement,
  successEl: HTMLElement,
  onBack: () => void,
): HTMLElement {
  const form = document.createElement('form');
  form.className = 'login-modal__form';
  form.appendChild(buildEmailField());

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'login-modal__submit interactive';
  submit.textContent = 'Send reset link';
  form.appendChild(submit);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'login-modal__footer-link';
  back.style.display = 'block';
  back.style.margin = 'var(--spacing-md) auto 0';
  back.textContent = '← Back to sign in';
  back.addEventListener('click', onBack);
  form.appendChild(back);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    const email = String(new FormData(form).get('email') ?? '').trim();
    if (!email) return;
    submit.disabled = true;
    const err = await resetPassword(email);
    submit.disabled = false;
    if (err) {
      errorEl.textContent = err;
      errorEl.hidden = false;
      return;
    }
    successEl.textContent = 'Check your email for a password reset link.';
    successEl.hidden = false;
  });

  return form;
}

function buildOAuthButton(
  provider: 'google' | 'github',
  label: string,
  iconSvg: string,
  errorEl: HTMLElement,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'login-modal__oauth-btn interactive';
  btn.innerHTML = `${iconSvg}${label}`;
  btn.addEventListener('click', async () => {
    errorEl.hidden = true;
    const err = await signInWithProvider(provider);
    if (err) {
      errorEl.textContent = err;
      errorEl.hidden = false;
    }
  });
  return btn;
}
