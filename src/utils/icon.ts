
const FA_SOLID = 'fa-solid';

export function icon(name: string, extraClass = 'ui-icon'): string {
  const classes = [FA_SOLID, `fa-${name}`, extraClass].filter(Boolean).join(' ');
  return `<i class="${classes}" aria-hidden="true"></i>`;
}

export function yeahIcon(extraClass = 'ui-icon yeah-icon'): string {
  const classes = extraClass.trim() || 'yeah-icon';
  return `<span class="${classes}" role="img" aria-hidden="true"></span>`;
}

export function yeahIconSpan(spanClass = 'btn-icon'): string {
  return `<span class="${spanClass}" aria-hidden="true">${yeahIcon('')}</span>`;
}

export function iconSpan(name: string, spanClass = 'btn-icon'): string {
  return `<span class="${spanClass}" aria-hidden="true">${icon(name, '')}</span>`;
}

export function discordIcon(extraClass = 'ui-icon'): string {
  return `<svg class="${extraClass} discord-icon" viewBox="0 0 20 19" aria-hidden="true"><use href="/icons.svg#discord-icon"></use></svg>`;
}

export function discordIconSpan(spanClass = 'btn-icon'): string {
  return `<span class="${spanClass}" aria-hidden="true">${discordIcon('')}</span>`;
}
