export const MOBILE_MQ = '(max-width: 768px)';
export const TABLET_MQ = '(max-width: 1024px)';

export function isMobile(): boolean {
  return window.matchMedia(MOBILE_MQ).matches;
}

export function isTablet(): boolean {
  return window.matchMedia(TABLET_MQ).matches;
}

export function onMobileChange(
  callback: (mobile: boolean) => void,
): () => void {
  const mq = window.matchMedia(MOBILE_MQ);
  const handler = (): void => callback(mq.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
