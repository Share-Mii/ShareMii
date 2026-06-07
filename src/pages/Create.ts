import './Create.css';
import './pages.css';
import '@/components/shared.css';
import '@/components/MiiMaker/MiiMaker.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createCategoryNav, updateCategoryNav } from '@/components/MiiMaker/CategoryNav';
import { attachMiiMakerLayout } from '@/components/MiiMaker/miiMakerLayout';
import { createMiiMakerPreview } from '@/components/MiiMaker/MiiMakerPreview';
import {
  createEditorWorkspace,
  type EditorWorkspaceHandle,
} from '@/components/MiiMaker/EditorControls';
import {
  closeSubmitModal,
  openSubmitModal,
} from '@/components/SubmitModal/SubmitModal';
import {
  applyGenderDefaults,
  createDefaultMiiFields,
  debounce,
  decodeBase64ToFields,
  encodeFieldsToBase64,
  miiFieldsToDecoded,
  MiiUndoStack,
  randomizeMiiFields,
  setNestedField,
  type EditorCategoryId,
  type MiiFields,
} from '@/services/miiEditor';
import { miiDataForEditor } from '@/services/remixNavigate';
import type { Mii } from '@/types';
import { iconSpan } from '@/utils/icon';
import { BRAND_NAME } from '@/config/brand';
import { DEFAULT_OG_IMAGE, getSiteOrigin, setPageMeta } from '@/utils/pageMeta';

export interface MiiMakerPageOptions {
  editMii?: Mii;
  remixMii?: Mii;
}

export function renderCreate(
  container: HTMLElement,
  options: MiiMakerPageOptions = {},
): () => void {
  const editMii = options.editMii;
  const remixMii = options.remixMii;
  const isEdit = Boolean(editMii);
  const isRemix = Boolean(remixMii);

  const origin = getSiteOrigin();
  const publicMaker = !isEdit && !isRemix;
  setPageMeta({
    title: isEdit
      ? 'Edit Mii'
      : isRemix
        ? 'Remix Mii'
        : 'Free Online Mii Maker — Create Mii QR Codes',
    description: isEdit
      ? 'Edit your Mii on ShareMii and update your shared QR code.'
      : isRemix
        ? 'Remix a community Mii in the ShareMii online Mii Maker.'
        : `Free online Mii Maker — create Nintendo Miis in your browser, export QR codes, and share with the ${BRAND_NAME} community.`,
    url: `${origin}/create`,
    image: DEFAULT_OG_IMAGE,
    jsonLd: publicMaker
      ? {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: `${BRAND_NAME} Mii Maker`,
          applicationCategory: 'DesignApplication',
          operatingSystem: 'Web browser',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          url: `${origin}/create`,
        }
      : undefined,
  });

  let aborted = false;
  let fields: MiiFields = createDefaultMiiFields(0);
  let previewBase64 = '';
  let activeCategory: EditorCategoryId = 'face';
  const undo = new MiiUndoStack();
  let workspace: EditorWorkspaceHandle | undefined;

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top create-page';

  const maker = document.createElement('div');
  maker.className = 'mii-maker';

  const toolbar = document.createElement('div');
  toolbar.className = 'mii-maker__toolbar';
  const toolbarTitle = document.createElement('h1');
  toolbarTitle.className = 'mii-maker__toolbar-title';
  toolbarTitle.textContent = isEdit
    ? 'Edit Mii'
    : isRemix
      ? 'Remix Mii'
      : 'Free Online Mii Maker';
  const toolbarActions = document.createElement('div');
  toolbarActions.className = 'mii-maker__toolbar-actions';
  toolbar.append(toolbarTitle, toolbarActions);

  const studio = document.createElement('div');
  studio.className = 'mii-maker__studio';

  const categoryNav = createCategoryNav(activeCategory, (id) => {
    activeCategory = id;
    updateCategoryNav(categoryNav, id);
    mountWorkspace();
  });

  const preview = createMiiMakerPreview('');

  const previewCol = document.createElement('div');
  previewCol.className = 'mii-maker__preview-col';
  previewCol.appendChild(preview.root);

  const workspaceHost = document.createElement('div');
  workspaceHost.className = 'mii-maker__workspace-host';

  studio.append(categoryNav, previewCol, workspaceHost);
  maker.append(toolbar, studio);
  page.append(maker);
  container.replaceChildren(wrapPublicPage(page));

  const detachLayout = attachMiiMakerLayout(studio, preview);

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'pill-btn interactive';
  undoBtn.innerHTML = `${iconSpan('rotate-left')}<span class="mii-maker__toolbar-btn-label"> Undo</span>`;
  undoBtn.setAttribute('aria-label', 'Undo');
  undoBtn.disabled = true;

  const randomBtn = document.createElement('button');
  randomBtn.type = 'button';
  randomBtn.className = 'pill-btn interactive';
  randomBtn.innerHTML = `${iconSpan('shuffle')}<span class="mii-maker__toolbar-btn-label"> Randomize</span>`;
  randomBtn.setAttribute('aria-label', 'Randomize');

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'pill-btn pill-btn--filled interactive';
  const shareLabel = isEdit ? 'Save Changes' : 'Share on ShareMii';
  shareBtn.innerHTML = isEdit
    ? `${iconSpan('floppy-disk')}<span class="mii-maker__toolbar-btn-label"> ${shareLabel}</span>`
    : `${iconSpan('share-nodes')}<span class="mii-maker__toolbar-btn-label"> ${shareLabel}</span>`;
  shareBtn.setAttribute('aria-label', shareLabel);

  toolbarActions.append(undoBtn, randomBtn, shareBtn);

  let cleanupModal: (() => void) | undefined;

  const callbacks = {
    getFields: () => fields,
    onChange: (current: MiiFields, path: string, value: unknown) => {
      undo.push(current);
      undoBtn.disabled = false;
      let next = setNestedField(current, path, value);
      if (path === 'general.gender' && (value === 0 || value === 1)) {
        next = applyGenderDefaults(next, value);
      }
      void applyFields(next, path);
    },
  };

  function mountWorkspace(): void {
    workspaceHost.classList.remove('mii-maker__workspace-host--enter');
    workspace?.destroy?.();
    workspace = createEditorWorkspace(activeCategory, fields, callbacks);
    workspaceHost.replaceChildren(workspace.root);
    requestAnimationFrame(() => {
      workspaceHost.classList.add('mii-maker__workspace-host--enter');
    });
  }

  const debouncedPreview = debounce((base64: string) => {
    if (aborted) return;
    preview.setMiiData(base64);
  }, 280);

  async function applyFields(
    next: MiiFields,
    changedPath?: string,
  ): Promise<void> {
    fields = next;
    try {
      previewBase64 = await encodeFieldsToBase64(fields);
      debouncedPreview(previewBase64);
      workspace?.sync(fields);
      if (changedPath === 'general.gender') {
        workspace?.resetPanels();
      }
    } catch {
      const restored = undo.pop(fields);
      if (restored) {
        fields = restored;
        previewBase64 = await encodeFieldsToBase64(fields).catch(() => previewBase64);
        debouncedPreview(previewBase64);
        workspace?.sync(fields);
      }
    }
  }

  undoBtn.addEventListener('click', () => {
    const prev = undo.pop(fields);
    if (!prev) return;
    void applyFields(prev);
    undoBtn.disabled = !undo.canUndo();
  });

  randomBtn.addEventListener('click', () => {
    undo.push(fields);
    undoBtn.disabled = false;
    void applyFields(randomizeMiiFields(fields)).then(() => {
      workspace?.resetPanels();
    });
  });

  shareBtn.addEventListener('click', () => {
    const name = preview.nameInput.value.trim() || 'Mii';
    fields = setNestedField(fields, 'meta.name', name);
    void miiFieldsToDecoded(fields, { existingMii: editMii ?? remixMii })
      .then((decoded) => {
        decoded.name = name;
        cleanupModal?.();
        cleanupModal = openSubmitModal(
          decoded,
          {
            onCancel: () => {
              cleanupModal = undefined;
            },
          },
          { editMii, remixOfMiiId: remixMii?.id },
        );
      })
      .catch((err) => {
        alert(
          err instanceof Error
            ? err.message
            : isEdit
              ? 'Could not prepare Mii for saving.'
              : 'Could not prepare Mii for sharing.',
        );
      });
  });

  preview.nameInput.addEventListener('change', () => {
    const name = preview.nameInput.value.trim() || 'Mii';
    fields = setNestedField(fields, 'meta.name', name);
  });

  async function boot(): Promise<void> {
    try {
      if (editMii) {
        fields = await decodeBase64ToFields(miiDataForEditor(editMii), {
          name: editMii.name,
        });
        preview.nameInput.value = editMii.name;
      } else if (remixMii) {
        const remixName = `Remix of ${remixMii.name}`.slice(0, 32);
        fields = await decodeBase64ToFields(miiDataForEditor(remixMii), {
          name: remixName,
        });
        preview.nameInput.value = remixName;
      }
      await applyFields(fields);
      if (aborted) return;
      mountWorkspace();
    } catch (err) {
      container.replaceChildren(
        wrapPublicPage(
          Object.assign(document.createElement('main'), {
            className: 'page-content page-content--offset-top',
            innerHTML: `<p class="page-error">${err instanceof Error ? escapeHtml(err.message) : 'Could not load this Mii for editing.'} <a href="/uploads">Back to uploads</a></p>`,
          }),
        ),
      );
    }
  }

  void boot();

  return () => {
    aborted = true;
    workspace?.destroy?.();
    detachLayout();
    debouncedPreview.cancel();
    cleanupModal?.();
    closeSubmitModal();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
