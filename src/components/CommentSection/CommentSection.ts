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
import { ensureRateLimitAllowed } from '@/utils/rateLimit';
import { appendCommentBody } from '@/utils/commentMentions';

export async function createCommentSection(miiId: string): Promise<HTMLElement> {
  const section = document.createElement('section');
  section.className = 'comments-section';
  section.setAttribute('aria-label', 'Comments');

  let replyingTo: Comment | null = null;
  const replyHost = document.createElement('div');
  replyHost.className = 'comments-section__reply-host';

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
  subtitle.textContent =
    'Share your thoughts. Use @gamertag to mention someone.';

  titleWrap.append(title, subtitle);
  header.appendChild(titleWrap);

  const composerHost = document.createElement('div');
  composerHost.className = 'comments-section__composer';

  const list = document.createElement('div');
  list.className = 'comments-section__list';

  section.append(header, composerHost, replyHost, list);

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
            onReply,
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

  function onReply(comment: Comment): void {
    replyingTo = comment;
    renderReplyComposer();
    replyHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderReplyComposer(): void {
    replyHost.replaceChildren();
    if (!replyingTo) return;

    const bar = document.createElement('div');
    bar.className = 'comments-reply-bar';

    const head = document.createElement('div');
    head.className = 'comments-reply-bar__head';

    const label = document.createElement('span');
    label.className = 'comments-reply-bar__label';
    label.innerHTML = `Replying to <strong>${escapeText(replyingTo.author_name)}</strong>`;

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'comments-reply-bar__cancel interactive';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      replyingTo = null;
      replyHost.replaceChildren();
    });

    head.append(label, cancel);

    const form = document.createElement('form');
    form.className = 'comments-composer comments-composer--reply';

    const field = document.createElement('div');
    field.className = 'comments-composer__field';

    const textarea = document.createElement('textarea');
    textarea.className = 'comments-composer__input';
    textarea.placeholder = 'Write a reply…';
    textarea.required = true;
    textarea.maxLength = 500;
    textarea.rows = 2;
    const mentionTarget = replyingTo.author_name.trim();
    if (mentionTarget) {
      textarea.value = `@${mentionTarget} `;
    }

    const actions = document.createElement('div');
    actions.className = 'comments-composer__actions';

    const hint = document.createElement('span');
    hint.className = 'comments-composer__hint';
    hint.textContent = 'Max 500 characters';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'pill-btn pill-btn--filled interactive';
    submit.textContent = 'Post reply';

    actions.append(hint, submit);
    field.append(textarea, actions);
    form.appendChild(field);
    bar.append(head, form);
    replyHost.appendChild(bar);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = textarea.value.trim();
      if (!body || !replyingTo) return;
      void postComment(body, replyingTo.id, form, submit);
    });

    textarea.focus();
  }

  async function postComment(
    body: string,
    parentId: string | null,
    form: HTMLFormElement,
    submit: HTMLButtonElement,
  ): Promise<void> {
    submit.disabled = true;
    try {
      await ensureRateLimitAllowed('comment');
      const id = await insertComment(miiId, body, parentId);
      const hold = await evaluateCommentForClientHold(body);
      if (hold.needsHold) {
        await shadowCommentClientPolicy(id, hold.detail);
      }
      form.reset();
      replyingTo = null;
      replyHost.replaceChildren();
      await loadComments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      submit.disabled = false;
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
    textarea.placeholder = 'Write a comment… (@username to mention)';
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
      await postComment(body, null, form, submit);
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
  onReply?: (c: Comment) => void,
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
  appendCommentBody(body, c.body);

  const actions = document.createElement('div');
  actions.className = 'comment-card__actions';

  if (onReply) {
    actions.appendChild(
      createIconActionButton({
        iconName: 'reply',
        label: 'Reply',
        className: 'comment-card__reply',
        onClick: () => onReply(c),
      }),
    );
  }

  main.append(meta, body, actions);

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

function escapeText(s: string): string {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
