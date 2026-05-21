import { clearAnnouncement, setAnnouncement } from '@/services/admin';
import type { Profile } from '@/types';
import { wrapAdminPage } from '@/pages/admin/adminShell';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';
export async function renderAdminSettings(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');
  content.className = 'admin-panel';

  const form = document.createElement('form');
  form.innerHTML = `
    <h2>Site announcement</h2>
    <p class="admin-meta">Shows a banner to all users on ShareMii.</p>
  `;

  const messageField = document.createElement('div');
  messageField.className = 'report-modal__field';
  const messageLabel = document.createElement('label');
  messageLabel.htmlFor = 'announce-message';
  messageLabel.textContent = 'Message';
  const messageInput = document.createElement('textarea');
  messageInput.id = 'announce-message';
  messageInput.rows = 2;
  messageInput.required = true;
  messageField.append(messageLabel, messageInput);

  const severityField = document.createElement('div');
  severityField.className = 'report-modal__field';
  const severityLabel = document.createElement('label');
  severityLabel.htmlFor = 'announce-severity';
  severityLabel.textContent = 'Severity';
  const severitySelect = createCustomSelect({
    id: 'announce-severity',
    ariaLabel: 'Announcement severity',
    variant: 'default',
    value: 'info',
    options: [
      { value: 'info', label: 'Info' },
      { value: 'warning', label: 'Warning' },
    ],
  });
  severityField.append(severityLabel, severitySelect.root);

  const actions = document.createElement('div');
  actions.className = 'admin-toolbar';
  const publishBtn = document.createElement('button');
  publishBtn.type = 'submit';
  publishBtn.className = 'pill-btn pill-btn--filled interactive';
  publishBtn.textContent = 'Publish banner';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'pill-btn pill-btn--outline interactive';
  clearBtn.textContent = 'Clear banner';
  actions.append(publishBtn, clearBtn);

  const status = document.createElement('p');
  status.className = 'admin-meta';
  status.hidden = true;

  form.append(messageField, severityField, actions, status);
  content.appendChild(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await setAnnouncement(
        messageInput.value.trim(),
        severitySelect.getValue() as 'info' | 'warning',
      );
      status.textContent = 'Announcement published.';
      status.hidden = false;
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Failed';
      status.hidden = false;
    }
  });

  clearBtn.addEventListener('click', async () => {
    try {
      await clearAnnouncement();
      status.textContent = 'Announcement cleared.';
      status.hidden = false;
      window.dispatchEvent(new Event('sharemii:announcement-updated'));
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Failed';
      status.hidden = false;
    }
  });

  const maintSection = document.createElement('div');
  maintSection.className = 'admin-panel';
  maintSection.style.marginTop = '1rem';
  maintSection.innerHTML = `
    <h2>Maintenance mode</h2>
    <p class="admin-meta">Publish a warning banner and apply upload restrictions manually via user restrictions if needed.</p>
  `;
  content.appendChild(maintSection);

  container.replaceChildren(wrapAdminPage(profile, 'Admin settings', content));
}
