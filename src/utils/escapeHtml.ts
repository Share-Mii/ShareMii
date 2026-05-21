
export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizePostgrestSearchTerm(term: string): string {
  return term
    .replace(/[,()]/g, ' ')
    .replace(/[%_\\]/g, '')
    .trim()
    .slice(0, 64);
}
