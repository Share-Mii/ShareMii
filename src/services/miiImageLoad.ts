const MAX_CONCURRENT = 6;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 150, 450] as const;

let inFlight = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      inFlight++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inFlight--;
  const next = waitQueue.shift();
  if (next) next();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function probeImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

export async function loadMiiImage(url: string): Promise<void> {
  await acquireSlot();
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const waitMs = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1)!;
      if (waitMs > 0) await delay(waitMs);
      try {
        await probeImage(url);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  } finally {
    releaseSlot();
  }
}

export function whenElementNearViewport(
  el: HTMLElement,
  rootMargin = '240px',
): Promise<void> {
  if (typeof IntersectionObserver === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          resolve();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
  });
}
