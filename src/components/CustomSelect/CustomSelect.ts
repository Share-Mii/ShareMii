import './CustomSelect.css';
import { iconSpan } from '@/utils/icon';

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomSelectConfig {
  options: CustomSelectOption[];
  value?: string;
  ariaLabel: string;
  id?: string;
  className?: string;
  variant?: 'pill' | 'default';
  onChange?: (value: string) => void;
}

export interface CustomSelectHandle {
  root: HTMLElement;
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  destroy: () => void;
}

export function createCustomSelect(
  config: CustomSelectConfig,
): CustomSelectHandle {
  const initial =
    config.value ??
    config.options.find((o) => !o.disabled)?.value ??
    '';

  let value = initial;

  const root = document.createElement('div');
  root.className = [
    'custom-select',
    config.variant === 'default' ? 'custom-select--default' : '',
    config.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select__trigger interactive';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', config.ariaLabel);
  if (config.id) trigger.id = config.id;

  const valueEl = document.createElement('span');
  valueEl.className = 'custom-select__value';

  const chevron = document.createElement('span');
  chevron.className = 'custom-select__chevron';
  chevron.innerHTML = iconSpan('chevron-down', '');

  trigger.append(valueEl, chevron);

  const menu = document.createElement('ul');
  menu.className = 'custom-select__menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  const optionButtons: HTMLButtonElement[] = [];

  function labelFor(v: string): string {
    return config.options.find((o) => o.value === v)?.label ?? v;
  }

  function syncTrigger(): void {
    valueEl.textContent = labelFor(value);
    for (const btn of optionButtons) {
      const selected = btn.dataset.value === value;
      btn.classList.toggle('custom-select__option--selected', selected);
      btn.setAttribute('aria-selected', String(selected));
    }
  }

  for (const opt of config.options) {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'custom-select__option interactive';
    btn.setAttribute('role', 'option');
    btn.dataset.value = opt.value;
    btn.textContent = opt.label;
    if (opt.disabled) btn.disabled = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      value = opt.value;
      syncTrigger();
      setOpen(false);
      config.onChange?.(value);
    });
    optionButtons.push(btn);
    li.appendChild(btn);
    menu.appendChild(li);
  }

  let open = false;

  const onDocClick = (e: MouseEvent): void => {
    const t = e.target as Node;
    if (root.contains(t)) return;
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false);
  };

  function setOpen(next: boolean): void {
    open = next;
    root.classList.toggle('custom-select--open', next);
    trigger.setAttribute('aria-expanded', String(next));
    menu.hidden = !next;
    if (next) {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onKey);
    } else {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    }
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  root.append(trigger, menu);
  syncTrigger();

  return {
    root,
    getValue: () => value,
    setValue: (v: string) => {
      value = v;
      syncTrigger();
    },
    focus: () => trigger.focus(),
    destroy: () => {
      setOpen(false);
      root.remove();
    },
  };
}
