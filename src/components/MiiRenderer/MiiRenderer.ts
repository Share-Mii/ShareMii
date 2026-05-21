import './MiiRenderer.css';
import { icon } from '@/utils/icon';
import {
  buildRenderUrl,
  DEFAULT_BODY_TYPE,
  DEFAULT_SHADER_TYPE,
  type RenderOptions,
} from '@/services/miiApi';
import { applyMiiView, type MiiViewPreset } from '@/services/miiViews';
import { normalizeMiiDataForRender } from '@/services/qrDecode';

export interface MiiRendererOptions {
  miiData: string;
  width?: number;
  alt?: string;
  className?: string;
  expression?: string;
  
  platform?: string;
  type?: string;
  view?: MiiViewPreset;
  characterYRotate?: number;
  cameraXRotate?: number;
}

export interface LiveMiiRendererHandle {
  root: HTMLElement;
  setMiiData: (miiData: string) => void;
  setView: (view: MiiViewPreset) => void;
  setExpression: (expression: string | undefined) => void;
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = new Image();
    probe.onload = () => resolve();
    probe.onerror = () => reject(new Error('Image load failed'));
    probe.src = url;
  });
}

function hasMiiData(data: string): boolean {
  return data.trim().length > 0;
}

function resolveRenderOptions(options: MiiRendererOptions): RenderOptions {
  const {
    width = 256,
    expression,
    type = 'face',
    view,
    characterYRotate,
    cameraXRotate,
  } = options;

  const base: RenderOptions = {
    width,
    expression,
    type,
    bodyType: DEFAULT_BODY_TYPE,
    shaderType: DEFAULT_SHADER_TYPE,
  };
  if (view) return applyMiiView(base, view);
  const next = { ...base };
  if (characterYRotate !== undefined) next.characterYRotate = characterYRotate;
  if (cameraXRotate !== undefined) next.cameraXRotate = cameraXRotate;
  return next;
}

export function createMiiRenderer(options: MiiRendererOptions): HTMLElement {
  const { miiData, alt = 'Mii', className = '' } = options;

  const root = document.createElement('div');
  root.className = `mii-renderer ${className}`.trim();

  const skeleton = document.createElement('div');
  skeleton.className = 'mii-renderer__skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  root.appendChild(skeleton);

  const renderOpts = resolveRenderOptions(options);

  const img = document.createElement('img');
  img.className = 'mii-renderer__img';
  img.alt = alt;
  img.style.display = 'none';
  root.appendChild(img);

  function showError(): void {
    skeleton.remove();
    img.remove();
    const err = document.createElement('div');
    err.className = 'mii-renderer__error';
    err.innerHTML = `<span class="mii-renderer__error-icon" aria-hidden="true">${icon('circle-exclamation')}</span><span>Could not render</span>`;
    root.appendChild(err);
  }

  void (async () => {
    if (!hasMiiData(miiData)) return;
    try {
      const renderData = await normalizeMiiDataForRender(miiData);
      const url = buildRenderUrl(renderData, renderOpts);

      img.onload = () => {
        skeleton.remove();
        img.style.display = 'block';
      };

      img.onerror = () => {
        showError();
      };

      img.src = url;
    } catch {
      showError();
    }
  })();

  return root;
}

export function createLiveMiiRenderer(
  options: MiiRendererOptions,
): LiveMiiRendererHandle {
  const { miiData, alt = 'Mii', className = '' } = options;

  const root = document.createElement('div');
  root.className = `mii-renderer mii-renderer--live ${className}`.trim();

  const skeleton = document.createElement('div');
  skeleton.className = 'mii-renderer__skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  root.appendChild(skeleton);

  let currentView: MiiViewPreset | undefined = options.view;
  let currentExpression: string | undefined = options.expression;
  let renderOpts = resolveRenderOptions(options);
  let currentMiiData = miiData;

  const baseRenderOpts = (): Omit<RenderOptions, 'characterYRotate' | 'cameraXRotate'> => ({
    width: options.width ?? 256,
    expression: currentExpression,
    type: options.type ?? 'face',
    bodyType: DEFAULT_BODY_TYPE,
    shaderType: DEFAULT_SHADER_TYPE,
  });

  function rebuildRenderOpts(): RenderOptions {
    const base = baseRenderOpts();
    if (currentView) return applyMiiView(base, currentView);
    return { ...base };
  }

  const stage = document.createElement('div');
  stage.className = 'mii-renderer__stage';
  root.appendChild(stage);

  const errorSlot = document.createElement('div');
  errorSlot.className = 'mii-renderer__error';
  errorSlot.hidden = true;
  root.appendChild(errorSlot);

  const imgA = document.createElement('img');
  const imgB = document.createElement('img');
  for (const el of [imgA, imgB]) {
    el.className = 'mii-renderer__img mii-renderer__img--live';
    el.alt = alt;
    el.decoding = 'async';
    stage.appendChild(el);
  }

  let front = imgA;
  let back = imgB;

  let loadGeneration = 0;
  let displayedUrl: string | null = null;
  let hasShownImage = false;

  function showError(): void {
    skeleton.remove();
    errorSlot.innerHTML = `<span class="mii-renderer__error-icon" aria-hidden="true">${icon('circle-exclamation')}</span><span>Could not render</span>`;
    errorSlot.hidden = false;
    stage.hidden = true;
  }

  function clearError(): void {
    errorSlot.hidden = true;
    errorSlot.innerHTML = '';
    stage.hidden = false;
  }

  async function applyMiiData(data: string): Promise<void> {
    if (!hasMiiData(data)) return;

    const generation = ++loadGeneration;
    try {
      const renderData = await normalizeMiiDataForRender(data);
      const url = buildRenderUrl(renderData, renderOpts);

      if (generation !== loadGeneration) return;
      if (url === displayedUrl) return;

      await preloadImage(url);
      if (generation !== loadGeneration) return;

      clearError();
      displayedUrl = url;
      back.src = url;
      back.classList.add('mii-renderer__img--visible');
      front.classList.remove('mii-renderer__img--visible');

      const prevFront = front;
      front = back;
      back = prevFront;

      if (!hasShownImage) {
        hasShownImage = true;
        skeleton.remove();
      }
    } catch {
      if (generation === loadGeneration) showError();
    }
  }

  if (hasMiiData(miiData)) {
    void applyMiiData(miiData);
  }

  return {
    root,
    setMiiData: (data: string) => {
      currentMiiData = data;
      displayedUrl = null;
      void applyMiiData(data);
    },
    setView: (view: MiiViewPreset) => {
      currentView = view;
      renderOpts = rebuildRenderOpts();
      displayedUrl = null;
      if (hasMiiData(currentMiiData)) {
        void applyMiiData(currentMiiData);
      }
    },
    setExpression: (expression: string | undefined) => {
      currentExpression = expression;
      renderOpts = rebuildRenderOpts();
      displayedUrl = null;
      if (hasMiiData(currentMiiData)) {
        void applyMiiData(currentMiiData);
      }
    },
  };
}
