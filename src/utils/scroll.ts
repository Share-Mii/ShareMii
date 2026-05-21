
export function scrollToTop(): void {
  window.scrollTo(0, 0);
}

export function scrollToTopIfAtTop(threshold = 24): void {
  if (window.scrollY <= threshold) {
    scrollToTop();
  }
}
