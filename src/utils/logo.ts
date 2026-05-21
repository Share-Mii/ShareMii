
export function logoMark(
  extraClass = '',
  options: { outline?: boolean; size?: 'sm' | 'md' | 'lg' } = {},
): string {
  const classes = [
    'sharemii-logo',
    options.outline ? 'sharemii-logo--outline' : '',
    options.size ? `sharemii-logo--${options.size}` : '',
    extraClass,
  ]
    .filter(Boolean)
    .join(' ');
  return `<span class="${classes}" role="img" aria-hidden="true"></span>`;
}
