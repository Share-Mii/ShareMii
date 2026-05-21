
export function revealOnNextFrame(el: HTMLElement, className: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add(className));
  });
}

export function runPageEnter(target: Element | null): void {
  if (!target) return;
  target.classList.remove('page-enter');
  void (target as HTMLElement).offsetWidth;
  requestAnimationFrame(() => target.classList.add('page-enter'));
}
