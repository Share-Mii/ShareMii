import './Settings.css';
import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { getAuthSession, isLoggedIn, signOut } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  cacheProfileUsername,
  ensureProfile,
  fetchProfileById,
  setProfileHidden,
  updateNotificationPreferences,
  updateProfile,
  uploadProfileImage,
} from '@/services/profile';
import { listBlockedUsers, unblockUser } from '@/services/safety';
import { isSupabaseConfigured, logProfileContentPolicyAttempt } from '@/services/supabase';
import { validateGamertag } from '@/utils/gamertag';
import { moderationFailReasonForUserText } from '@/utils/contentModeration';
import { escapeAttr, escapeHtml } from '@/utils/escapeHtml';
import {
  deleteAccount,
  downloadUserDataExport,
  exportUserData,
} from '@/services/userData';
import type { Profile } from '@/types';

function avatarInitial(profile: Profile): string {
  const ch = profile.username?.trim()?.[0];
  return ch ? ch.toUpperCase() : '?';
}

function buildAvatarRow(
  profile: Profile,
  onUpdate: (p: Profile) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const preview = document.createElement('div');
  preview.className = 'settings-row__preview settings-row__preview--avatar';

  const renderPreview = (p: Profile): void => {
    preview.replaceChildren();
    if (p.avatar_url) {
      const img = document.createElement('img');
      img.src = p.avatar_url;
      img.alt = '';
      preview.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.textContent = avatarInitial(p);
      preview.appendChild(span);
    }
  };
  renderPreview(profile);

  const body = document.createElement('div');
  body.className = 'settings-row__body';
  const label = document.createElement('span');
  label.className = 'settings-row__label';
  label.textContent = 'Profile picture';
  const hint = document.createElement('p');
  hint.className = 'settings-row__hint';
  hint.textContent = 'A photo helps people recognize you on ShareMii.';
  body.append(label, hint);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.className = 'settings-page__hidden-input';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill-btn pill-btn--outline interactive';
  btn.textContent = 'Change';
  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    btn.setAttribute('disabled', 'true');
    try {
      const updated = await uploadProfileImage(profile.id, 'avatar', file);
      onUpdate(updated);
      renderPreview(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      btn.removeAttribute('disabled');
      input.value = '';
    }
  });

  const action = document.createElement('div');
  action.className = 'settings-row__action';
  action.append(input, btn);

  row.append(preview, body, action);
  return row;
}

function buildBannerRow(
  profile: Profile,
  onUpdate: (p: Profile) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const preview = document.createElement('div');
  preview.className = 'settings-row__preview settings-row__preview--banner';

  const renderPreview = (p: Profile): void => {
    preview.replaceChildren();
    if (p.banner_url) {
      const img = document.createElement('img');
      img.src = p.banner_url;
      img.alt = '';
      preview.appendChild(img);
    }
  };
  renderPreview(profile);

  const body = document.createElement('div');
  body.className = 'settings-row__body';
  const label = document.createElement('span');
  label.className = 'settings-row__label';
  label.textContent = 'Profile banner';
  const hint = document.createElement('p');
  hint.className = 'settings-row__hint';
  hint.textContent = 'Shown at the top of your public profile.';
  body.append(label, hint);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.className = 'settings-page__hidden-input';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill-btn pill-btn--outline interactive';
  btn.textContent = 'Change';
  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    btn.setAttribute('disabled', 'true');
    try {
      const updated = await uploadProfileImage(profile.id, 'banner', file);
      onUpdate(updated);
      renderPreview(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      btn.removeAttribute('disabled');
      input.value = '';
    }
  });

  const action = document.createElement('div');
  action.className = 'settings-row__action';
  action.append(input, btn);

  row.append(preview, body, action);
  return row;
}

export function renderSettings(container: HTMLElement): () => void {
  let abort = false;

  const page = document.createElement('main');
  page.className = 'settings-page page-content page-content--offset-top';
  page.innerHTML = '<p class="page-loading">Loading settings…</p>';
  container.replaceChildren(wrapPublicPage(page));

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    const session = await getAuthSession();
    if (!isLoggedIn(session)) {
      openLoginModal();
      window.location.hash = '#/';
      return;
    }

    const userId = session!.user.id;
    const profile =
      (await fetchProfileById(userId)) ?? (await ensureProfile(userId));
    if (abort) return;

    page.replaceChildren();
    page.appendChild(buildSettingsPage(profile, userId));
  }

  load();

  return () => {
    abort = true;
  };
}

function buildSettingsPage(profile: Profile, userId: string): HTMLElement {
  let currentProfile = { ...profile };

  const onProfileUpdate = (updated: Profile): void => {
    currentProfile = updated;
    cacheProfileUsername(userId, updated.username);
    window.dispatchEvent(new CustomEvent('sharemii:profile-updated'));
  };

  const pageTitle = document.createElement('h1');
  pageTitle.className = 'settings-page__title';
  pageTitle.textContent = 'Settings';

  const profileCard = document.createElement('section');
  profileCard.className = 'settings-page__card';
  profileCard.setAttribute('aria-labelledby', 'settings-profile-heading');

  const profileHeading = document.createElement('h2');
  profileHeading.id = 'settings-profile-heading';
  profileHeading.className = 'settings-page__card-title';
  profileHeading.textContent = 'Profile';

  const profileLead = document.createElement('p');
  profileLead.className = 'settings-page__card-lead';
  profileLead.textContent =
    'Manage how you appear on ShareMii. Changes to your gamertag and bio apply after you save.';

  profileCard.append(
    profileHeading,
    profileLead,
    buildAvatarRow(currentProfile, onProfileUpdate),
    buildBannerRow(currentProfile, onProfileUpdate),
  );

  const usernameRow = document.createElement('div');
  usernameRow.className = 'settings-row settings-row--stacked';
  usernameRow.innerHTML =
    '<label class="settings-row__label" for="settings-username">Gamertag</label>' +
    `<input class="settings-row__input" id="settings-username" name="username" maxlength="15" autocomplete="username" value="${escapeAttr(currentProfile.username)}" />` +
    '<p class="settings-row__hint" data-username-hint></p>';

  const bioRow = document.createElement('div');
  bioRow.className = 'settings-row settings-row--stacked';
  bioRow.innerHTML =
    '<label class="settings-row__label" for="settings-bio">Bio</label>' +
    `<textarea class="settings-row__textarea" id="settings-bio" name="bio" maxlength="500" placeholder="Tell others about yourself…">${escapeHtml(currentProfile.bio)}</textarea>` +
    '<p class="settings-row__hint settings-row__hint--error settings-row__hint--field-error" data-bio-error hidden></p>';

  const formFooter = document.createElement('div');
  formFooter.className = 'settings-page__form-footer';

  const formError = document.createElement('p');
  formError.className =
    'settings-page__form-message settings-page__form-message--error';
  formError.hidden = true;

  const formSuccess = document.createElement('p');
  formSuccess.className =
    'settings-page__form-message settings-page__form-message--success';
  formSuccess.hidden = true;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pill-btn pill-btn--filled interactive';
  saveBtn.textContent = 'Save';

  formFooter.append(formError, formSuccess, saveBtn);
  profileCard.append(usernameRow, bioRow, formFooter);

  const usernameInput =
    usernameRow.querySelector<HTMLInputElement>('#settings-username')!;
  const usernameHint = usernameRow.querySelector('[data-username-hint]')!;
  const bioInput = bioRow.querySelector<HTMLTextAreaElement>('#settings-bio')!;
  const bioError = bioRow.querySelector<HTMLElement>('[data-bio-error]')!;

  function updateUsernameHint(): void {
    const result = validateGamertag(usernameInput.value);
    if (!usernameInput.value.trim()) {
      usernameHint.textContent = '3–15 characters; letters, numbers, and underscores.';
      usernameHint.classList.remove('settings-row__hint--error');
      return;
    }
    usernameHint.textContent = result.ok
      ? 'Valid gamertag'
      : (result.error ?? '');
    usernameHint.classList.toggle('settings-row__hint--error', !result.ok);
  }
  usernameInput.addEventListener('input', updateUsernameHint);
  updateUsernameHint();

  bioInput.addEventListener('input', () => {
    bioError.hidden = true;
    bioError.textContent = '';
  });

  saveBtn.addEventListener('click', async () => {
    formError.hidden = true;
    formSuccess.hidden = true;
    bioError.hidden = true;
    bioError.textContent = '';
    const validation = validateGamertag(usernameInput.value.trim());
    if (!validation.ok) {
      formError.textContent = validation.error ?? 'Invalid gamertag';
      formError.hidden = false;
      return;
    }

    const usernameTrim = usernameInput.value.trim();
    const usernamePolicy = await moderationFailReasonForUserText(usernameTrim);
    if (usernamePolicy) {
      formError.textContent = usernamePolicy;
      formError.hidden = false;
      void logProfileContentPolicyAttempt('username', usernameTrim, usernamePolicy);
      return;
    }

    const bioTrim = bioInput.value.trim();
    const bioPolicy = await moderationFailReasonForUserText(bioTrim);
    if (bioPolicy) {
      bioError.textContent = bioPolicy;
      bioError.hidden = false;
      void logProfileContentPolicyAttempt('bio', bioTrim, bioPolicy);
      return;
    }

    saveBtn.setAttribute('disabled', 'true');
    try {
      const updated = await updateProfile(userId, {
        username: usernameTrim,
        bio: bioTrim,
      });
      onProfileUpdate(updated);
      formSuccess.textContent = 'Changes saved.';
      formSuccess.hidden = false;
    } catch (err) {
      formError.textContent =
        err instanceof Error ? err.message : 'Could not save profile.';
      formError.hidden = false;
    } finally {
      saveBtn.removeAttribute('disabled');
    }
  });

  const notifCard = document.createElement('section');
  notifCard.className = 'settings-page__card';
  notifCard.id = 'notification-settings';
  notifCard.setAttribute('aria-labelledby', 'settings-notif-heading');

  const notifHeading = document.createElement('h2');
  notifHeading.id = 'settings-notif-heading';
  notifHeading.className = 'settings-page__card-title';
  notifHeading.textContent = 'Notifications';

  const notifLead = document.createElement('p');
  notifLead.className = 'settings-page__card-lead';
  notifLead.textContent = 'Choose which activity you want to be notified about.';

  const toggles = document.createElement('div');
  toggles.className = 'settings-page__toggles';

  const prefs = [
    {
      key: 'notify_comments' as const,
      label: 'Comments on my Miis',
      checked: currentProfile.notify_comments ?? true,
    },
    {
      key: 'notify_yeahs' as const,
      label: 'Yeahs on my Miis',
      checked: currentProfile.notify_yeahs ?? true,
    },
    {
      key: 'notify_favorites' as const,
      label: 'Favorites on my Miis',
      checked: currentProfile.notify_favorites ?? true,
    },
  ];

  for (const pref of prefs) {
    const label = document.createElement('label');
    label.className = 'settings-page__toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = pref.checked;
    input.addEventListener('change', async () => {
      try {
        const updated = await updateNotificationPreferences(userId, {
          [pref.key]: input.checked,
        });
        onProfileUpdate(updated);
      } catch (err) {
        input.checked = !input.checked;
        alert(err instanceof Error ? err.message : 'Could not update');
      }
    });

    const span = document.createElement('span');
    span.textContent = pref.label;
    label.append(span, input);
    toggles.appendChild(label);
  }

  notifCard.append(notifHeading, notifLead, toggles);

  const privacyCard = document.createElement('section');
  privacyCard.className = 'settings-page__card';
  privacyCard.setAttribute('aria-labelledby', 'settings-privacy-heading');

  const privacyHeading = document.createElement('h2');
  privacyHeading.id = 'settings-privacy-heading';
  privacyHeading.className = 'settings-page__card-title';
  privacyHeading.textContent = 'Privacy';

  const privacyLead = document.createElement('p');
  privacyLead.className = 'settings-page__card-lead';
  privacyLead.textContent =
    'Hide your profile from browse and search. You can still share direct profile links.';

  const hiddenLabel = document.createElement('label');
  hiddenLabel.className = 'settings-page__toggle';
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'checkbox';
  hiddenInput.checked = currentProfile.profile_hidden;
  hiddenInput.addEventListener('change', async () => {
    try {
      const updated = await setProfileHidden(hiddenInput.checked);
      onProfileUpdate(updated);
    } catch (err) {
      hiddenInput.checked = !hiddenInput.checked;
      alert(err instanceof Error ? err.message : 'Could not update privacy');
    }
  });
  const hiddenSpan = document.createElement('span');
  hiddenSpan.textContent = 'Hide my profile from browse and search';
  hiddenLabel.append(hiddenSpan, hiddenInput);

  const blockedHost = document.createElement('div');
  blockedHost.className = 'settings-page__blocked';

  async function loadBlocked(): Promise<void> {
    blockedHost.replaceChildren();
    try {
      const blocked = await listBlockedUsers();
      if (!blocked.length) {
        blockedHost.innerHTML =
          '<p class="settings-row__hint">You have not blocked anyone.</p>';
        return;
      }
      const list = document.createElement('ul');
      list.className = 'settings-page__blocked-list';
      for (const row of blocked) {
        const li = document.createElement('li');
        li.className = 'settings-page__blocked-item';
        const name = document.createElement('span');
        name.textContent = row.username;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill-btn pill-btn--outline interactive';
        btn.textContent = 'Unblock';
        btn.addEventListener('click', () => {
          void unblockUser(row.user_id)
            .then(() => loadBlocked())
            .catch((err) =>
              alert(err instanceof Error ? err.message : 'Failed'),
            );
        });
        li.append(name, btn);
        list.appendChild(li);
      }
      blockedHost.appendChild(list);
    } catch {
      blockedHost.innerHTML =
        '<p class="settings-row__hint">Could not load blocked users.</p>';
    }
  }

  void loadBlocked();

  const blockedTitle = document.createElement('p');
  blockedTitle.className = 'settings-row__label';
  blockedTitle.textContent = 'Blocked users';

  privacyCard.append(
    privacyHeading,
    privacyLead,
    hiddenLabel,
    blockedTitle,
    blockedHost,
  );

  const dataCard = document.createElement('section');
  dataCard.className = 'settings-page__card';
  dataCard.id = 'your-data';
  dataCard.setAttribute('aria-labelledby', 'settings-data-heading');

  const dataHeading = document.createElement('h2');
  dataHeading.id = 'settings-data-heading';
  dataHeading.className = 'settings-page__card-title';
  dataHeading.textContent = 'Your data & account';

  const dataLead = document.createElement('p');
  dataLead.className = 'settings-page__card-lead';
  dataLead.textContent =
    'Download a copy of your data, review our policies, or permanently delete your account.';

  const exportRow = document.createElement('div');
  exportRow.className = 'settings-row';
  const exportBody = document.createElement('div');
  exportBody.className = 'settings-row__body';
  exportBody.innerHTML =
    '<span class="settings-row__label">Download my data</span>' +
    '<p class="settings-row__hint">Exports your profile, Miis, comments, favorites, and related records as JSON.</p>';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'pill-btn pill-btn--outline interactive';
  exportBtn.textContent = 'Download';
  exportBtn.addEventListener('click', async () => {
    exportBtn.setAttribute('disabled', 'true');
    try {
      const data = await exportUserData();
      downloadUserDataExport(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      exportBtn.removeAttribute('disabled');
    }
  });
  const exportAction = document.createElement('div');
  exportAction.className = 'settings-row__action';
  exportAction.appendChild(exportBtn);
  exportRow.append(exportBody, exportAction);

  const legalRow = document.createElement('div');
  legalRow.className = 'settings-row';
  legalRow.innerHTML =
    '<div class="settings-row__body">' +
    '<span class="settings-row__label">Privacy & legal</span>' +
    '<p class="settings-row__hint">Privacy Policy, Terms, and how we handle your information.</p>' +
    '</div>' +
    '<div class="settings-row__action settings-row__action--links">' +
    '<a href="#/privacy" class="settings-page__inline-link interactive">Privacy</a>' +
    '<a href="#/terms" class="settings-page__inline-link interactive">Terms</a>' +
    '<a href="#/delete-account" class="settings-page__inline-link interactive">Deletion info</a>' +
    '</div>';

  const deleteRow = document.createElement('div');
  deleteRow.className = 'settings-row settings-row--stacked settings-row--danger';
  deleteRow.innerHTML =
    '<span class="settings-row__label">Delete my account</span>' +
    '<p class="settings-row__hint">Permanently removes your account, profile, Miis, and comments. This cannot be undone.</p>';

  const confirmLabel = document.createElement('label');
  confirmLabel.className = 'settings-row__label';
  confirmLabel.htmlFor = 'settings-delete-confirm';
  confirmLabel.textContent = `Type your gamertag (${escapeHtml(currentProfile.username)}) to confirm`;

  const confirmInput = document.createElement('input');
  confirmInput.id = 'settings-delete-confirm';
  confirmInput.className = 'settings-row__input';
  confirmInput.type = 'text';
  confirmInput.autocomplete = 'off';
  confirmInput.placeholder = currentProfile.username;

  const deleteError = document.createElement('p');
  deleteError.className =
    'settings-row__hint settings-row__hint--error settings-row__hint--field-error';
  deleteError.hidden = true;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'pill-btn pill-btn--outline interactive settings-page__danger-btn';
  deleteBtn.textContent = 'Delete my account';
  deleteBtn.addEventListener('click', async () => {
    deleteError.hidden = true;
    const confirm = confirmInput.value.trim();
    if (!confirm) {
      deleteError.textContent = 'Enter your gamertag to confirm.';
      deleteError.hidden = false;
      return;
    }
    if (
      !window.confirm(
        'Delete your account permanently? All your Miis, comments, and profile data will be removed.',
      )
    ) {
      return;
    }
    deleteBtn.setAttribute('disabled', 'true');
    try {
      await deleteAccount(confirm);
      await signOut();
      window.location.hash = '#/';
      window.location.reload();
    } catch (err) {
      deleteError.textContent =
        err instanceof Error ? err.message : 'Could not delete account.';
      deleteError.hidden = false;
      deleteBtn.removeAttribute('disabled');
    }
  });

  deleteRow.append(confirmLabel, confirmInput, deleteError, deleteBtn);
  dataCard.append(dataHeading, dataLead, exportRow, legalRow, deleteRow);

  const accountSection = document.createElement('section');
  accountSection.className = 'settings-page__account';
  accountSection.setAttribute('aria-label', 'Account');

  const signOutBtn = document.createElement('button');
  signOutBtn.type = 'button';
  signOutBtn.className = 'pill-btn pill-btn--outline interactive';
  signOutBtn.textContent = 'Sign out';
  signOutBtn.addEventListener('click', async () => {
    const err = await signOut();
    if (err) alert(err);
    else window.location.hash = '#/';
  });

  accountSection.append(signOutBtn);

  const root = document.createElement('div');
  root.append(
    pageTitle,
    profileCard,
    notifCard,
    privacyCard,
    dataCard,
    accountSection,
  );
  return root;
}
