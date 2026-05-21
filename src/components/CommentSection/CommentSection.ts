import './CommentSection.css';
import '@/components/shared.css';
import '@/components/IconActionButton/IconActionButton.css';
import { createIconActionButton } from '@/components/IconActionButton/IconActionButton';
import type { Session } from '@supabase/supabase-js';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { fetchComments, insertComment, shadowCommentClientPolicy } from '@/services/supabase';
import {
  getAuthSession,
  isLoggedIn,
  subscribeAuth,
} from '@/services/auth';
import type { Comment } from '@/types';
import { pastelCssVarFromId } from '@/styles/pastelColors';
import { icon, iconSpan } from '@/utils/icon';
import { openReportModal } from '@/components/ReportModal/ReportModal';
import { evaluateCommentForClientHold } from '@/utils/contentModeration';

export async function createCommentSection(miiId: string): Promise<HTMLElement> {
  const section = document.createElement('section');
  section.className = 'comments-section';
  section.setAttribute('aria-label', 'Comments');

  const header = document.createElement('header');
  header.className = 'comments-section__head';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'comments-section__title-wrap';

  const title = document.createElement('h2');
  title.className = 'comments-section__title section-title';
  title.innerHTML = `${icon('comments')} Comments`;

  const countBadge = document.createElement('span');
  countBadge.className = 'comments-section__count';
  countBadge.textContent = '0';
  title.appendChild(countBadge);

  const subtitle = document.createElement('p');
  subtitle.className = 'comments-section__subtitle';
  subtitle.textContent = 'Share your thoughts about this resident.';

  titleWrap.append(title, subtitle);
  header.appendChild(titleWrap);

  const composerHost = document.createElement('div');
  composerHost.className = 'comments-section__composer';

  const list = document.createElement('div');
  list.className = 'comments-section__list';

  section.append(header, composerHost, list);

  function updateCount(comments: Comment[]): void {
    countBadge.textContent = String(comments.length);
    countBadge.hidden = comments.length === 0;
  }

  async function loadComments(): Promise<void> {
    list.replaceChildren();
    try {
      const comments = await fetchComments(miiId);
      updateCount(comments);
      if (comments.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'comments-section__empty';
        empty.innerHTML = `${iconSpan('comment')} No comments yet — be the first to say hello!`;
        list.appendChild(empty);
      } else {
        const topLevel = comments.filter((c) => !c.parent_id);
        const repliesByParent = new Map<string, Comment[]>();
        for (const c of comments) {
          if (!c.parent_id) continue;
          const arr = repliesByParent.get(c.parent_id) ?? [];
          arr.push(c);
          repliesByParent.set(c.parent_id, arr);
        }
        for (let i = 0; i < topLevel.length; i++) {
          const card = renderComment(
            topLevel[i]!,
            miiId,
            repliesByParent.get(topLevel[i]!.id) ?? [],
          );
          card.style.setProperty('--stagger-index', String(i));
          list.appendChild(card);
        }
      }
    } catch {
      const err = document.createElement('p');
      err.className = 'comments-section__empty comments-section__empty--error';
      err.textContent = 'Could not load comments.';
      list.appendChild(err);
    }
  }

  function renderComposer(session: Session | null): void {
    composerHost.replaceChildren();

    if (!isLoggedIn(session)) {
      const prompt = document.createElement('div');
      prompt.className = 'comments-section__signin';
      prompt.innerHTML = `
        <p class="comments-section__signin-text">Sign in to join the conversation.</p>
      `;
      const loginBtn = document.createElement('button');
      loginBtn.type = 'button';
      loginBtn.className = 'pill-btn pill-btn--filled interactive';
      loginBtn.textContent = 'Sign in';
      loginBtn.addEventListener('click', () => openLoginModal());
      prompt.appendChild(loginBtn);
      composerHost.appendChild(prompt);
      return;
    }

    const form = document.createElement('form');
    form.className = 'comments-composer';

    const field = document.createElement('div');
    field.className = 'comments-composer__field';

    const textarea = document.createElement('textarea');
    textarea.className = 'comments-composer__input';
    textarea.name = 'body';
    textarea.placeholder = 'Write a comment…';
    textarea.required = true;
    textarea.maxLength = 500;
    textarea.rows = 2;

    const actions = document.createElement('div');
    actions.className = 'comments-composer__actions';

    const hint = document.createElement('span');
    hint.className = 'comments-composer__hint';
    hint.textContent = 'Max 500 characters';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'pill-btn pill-btn--filled interactive';
    submit.innerHTML = `${iconSpan('paper-plane')} Post comment`;

    actions.append(hint, submit);
    field.append(textarea, actions);
    form.appendChild(field);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = String(new FormData(form).get('body') ?? '').trim();
      if (!body) return;

      submit.setAttribute('disabled', 'true');

      try {
        const id = await insertComment(miiId, body);
        const hold = await evaluateCommentForClientHold(body);
        if (hold.needsHold) {
          await shadowCommentClientPolicy(id, hold.detail);
        }
        form.reset();
        await loadComments();
      } catch (err) {
        alert(
          err instanceof Error ? err.message : 'Failed to post comment.',
        );
      } finally {
        submit.removeAttribute('disabled');
      }
    });

    composerHost.appendChild(form);
  }

  renderComposer(await getAuthSession());
  subscribeAuth(renderComposer);
  await loadComments();
  return section;
}

function renderComment(
  c: Comment,
  miiId: string,
  replies: Comment[] = [],
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'comment-card';

  const avatar = document.createElement('div');
  avatar.className = 'comment-card__avatar';
  avatar.style.backgroundColor = avatarColor(c.author_name);
  avatar.textContent = getInitials(c.author_name);
  avatar.setAttribute('aria-hidden', 'true');

  const main = document.createElement('div');
  main.className = 'comment-card__body';

  const meta = document.createElement('div');
  meta.className = 'comment-card__meta';

  const author = document.createElement('span');
  author.className = 'comment-card__author';
  author.textContent = c.author_name;

  const time = document.createElement('time');
  time.className = 'comment-card__time';
  time.dateTime = c.created_at;
  time.textContent = formatRelativeTime(c.created_at);

  const reportBtn = document.createElement('button');
  reportBtn.type = 'button';
  reportBtn.className = 'comment-card__report interactive';
  reportBtn.setAttribute('aria-label', 'Report comment');
  reportBtn.title = 'Report';
  reportBtn.innerHTML = icon('flag');
  reportBtn.addEventListener('click', () => {
    openReportModal({
      targetType: 'comment',
      targetId: c.id,
      targetLabel: `Comment by ${c.author_name}`,
    });
  });

  meta.append(author, time, reportBtn);

  const body = document.createElement('p');
  body.className = 'comment-card__text';
  body.textContent = c.body;

  const replyBtn = createIconActionButton({
    iconName: 'reply',
    label: 'Reply',
    className: 'comment-card__reply',
    onClick: () => {
    const text = window.prompt('Write a reply (max 500 characters):');
    if (!text?.trim()) return;
    void (async () => {
      const session = await getAuthSession();
      if (!isLoggedIn(session)) {
        openLoginModal();
        return;
      }
      try {
        const id = await insertComment(
          miiId,
          text.trim().slice(0, 500),
          c.id,
        );
        const hold = await evaluateCommentForClientHold(text.trim());
        if (hold.needsHold) {
          await shadowCommentClientPolicy(id, hold.detail);
        }
        window.location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not post reply.');
      }
    })();
    },
  });

  main.append(meta, body, replyBtn);

  if (replies.length) {
    const repliesWrap = document.createElement('div');
    repliesWrap.className = 'comment-card__replies';
    for (const r of replies) {
      repliesWrap.appendChild(renderComment(r, miiId));
    }
    main.appendChild(repliesWrap);
  }

  card.append(avatar, main);
  return card;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  return pastelCssVarFromId(name);
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
