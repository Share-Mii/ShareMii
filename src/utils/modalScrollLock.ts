let lockCount = 0;
let prevOverflow = '';

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

export function unlockBodyScroll(): void {
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = prevOverflow;
  }
}
