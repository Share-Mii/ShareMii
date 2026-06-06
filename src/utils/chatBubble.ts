import '@/styles/chat-bubble.css';

let activeBubble: HTMLElement | null = null;
let activeHost: HTMLElement | null = null;

function removeActiveBubble(): void {
  activeBubble?.remove();
  activeBubble = null;
  activeHost = null;
}

export type ChatBubblePlacement = 'bottom' | 'left';

function getPlacement(host: HTMLElement): ChatBubblePlacement {
  return host.dataset.chatBubblePlacement === 'left' ? 'left' : 'bottom';
}

function placeBubble(host: HTMLElement, bubble: HTMLElement): void {
  const rect = host.getBoundingClientRect();
  const placement = getPlacement(host);
  bubble.classList.toggle('chat-bubble-popup--left', placement === 'left');
  if (placement === 'left') {
    bubble.style.left = `${rect.left - 10}px`;
    bubble.style.top = `${rect.top + rect.height / 2}px`;
    return;
  }
  bubble.style.left = `${rect.left + rect.width / 2}px`;
  bubble.style.top = `${rect.bottom + 10}px`;
}

function showBubble(host: HTMLElement, text: string): void {
  if (activeHost && activeHost !== host) {
    removeActiveBubble();
  }

  if (!activeBubble || activeHost !== host) {
    removeActiveBubble();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble-popup';
    bubble.setAttribute('role', 'tooltip');
    document.body.appendChild(bubble);
    activeBubble = bubble;
    activeHost = host;
  }

  activeBubble.textContent = text;
  placeBubble(host, activeBubble);
  activeBubble.classList.add('chat-bubble-popup--visible');
}

function hideBubble(host: HTMLElement): void {
  if (activeHost !== host) return;
  activeBubble?.classList.remove('chat-bubble-popup--visible');
  removeActiveBubble();
}

function onReposition(): void {
  if (activeBubble && activeHost) {
    placeBubble(activeHost, activeBubble);
  }
}

let listenersBound = false;

function ensureGlobalListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);
}

/** Floating chat bubble near `host`, appended to document.body (avoids overflow clipping). */
export function bindChatBubble(
  host: HTMLElement,
  textOrGetter: string | (() => string),
  options?: { placement?: ChatBubblePlacement },
): void {
  if (options?.placement) {
    host.dataset.chatBubblePlacement = options.placement;
  }

  ensureGlobalListeners();

  const getText =
    typeof textOrGetter === 'function' ? textOrGetter : () => textOrGetter;

  const reveal = (): void => showBubble(host, getText());
  const conceal = (): void => hideBubble(host);

  host.addEventListener('mouseenter', reveal);
  host.addEventListener('mouseleave', conceal);
  host.addEventListener('focus', reveal);
  host.addEventListener('blur', conceal);
}
