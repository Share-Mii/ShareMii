import { profileUrlForUsername } from '@/utils/creatorLink';

/** Matches @gamertags per app rules (letters, numbers, single spaces between segments). */
export function commentMentionPattern(): RegExp {
  return /@([A-Za-z][A-Za-z0-9]{0,12}(?: [A-Za-z0-9]+){0,4})/g;
}

export function isValidMentionToken(token: string): boolean {
  const t = token.trim();
  return t.length >= 3 && t.length <= 15 && /^[A-Za-z]/.test(t);
}

export function appendCommentBody(
  container: HTMLElement,
  body: string,
): void {
  container.replaceChildren();
  let lastIndex = 0;

  for (const match of body.matchAll(commentMentionPattern())) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      container.appendChild(
        document.createTextNode(body.slice(lastIndex, index)),
      );
    }

    const username = match[1] ?? '';
    if (isValidMentionToken(username)) {
      const link = document.createElement('a');
      link.href = profileUrlForUsername(username.trim());
      link.className = 'comment-mention interactive';
      link.textContent = `@${username}`;
      link.addEventListener('click', (e) => e.stopPropagation());
      container.appendChild(link);
    } else {
      container.appendChild(document.createTextNode(match[0]));
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    container.appendChild(document.createTextNode(body.slice(lastIndex)));
  }
}
