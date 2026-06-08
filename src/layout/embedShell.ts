import './embedShell.css';

export function wrapEmbedPage(content: HTMLElement): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'embed-shell';
  shell.appendChild(content);
  return shell;
}
