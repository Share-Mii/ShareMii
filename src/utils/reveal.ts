export function revealOnNextFrame(el: HTMLElement, className: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add(className));
  });
}

/** Apply an entrance class after layout; skips frame delay when motion is reduced. */
export function revealWithMotion(el: HTMLElement, className: string): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add(className);
    return;
  }
  revealOnNextFrame(el, className);
}

export function runPageEnter(target: Element | null): void {
  if (!target) return;
  target.classList.remove('page-enter');
  void (target as HTMLElement).offsetWidth;
  requestAnimationFrame(() => target.classList.add('page-enter'));
}
