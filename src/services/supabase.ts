import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthSession } from '@/services/auth';
import { clearBrowserToken, getBrowserToken } from '@/utils/browserToken';
import { sanitizePostgrestSearchTerm } from '@/utils/escapeHtml';
import { truncateMiiName } from '@/utils/miiName';
import type {
  Comment,
  Gender,
  InsertMiiPayload,
  Mii,
  MiiStat,
  Notification,
  NotificationRow,
  Platform,
  SortOption,
  SourceFilter,
  UpdateMiiPayload,
} from '@/types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
    );
  }
  client ??= createClient(url, anonKey);
  return client;
}

function getClient(): SupabaseClient {
  return getSupabaseClient();
}

function normalizeMii(row: Record<string, unknown>): Mii {
  return {
    ...(row as unknown as Mii),
    visibility: (row.visibility as Mii['visibility']) ?? 'public',
    hidden_reason: (row.hidden_reason as string | null) ?? null,
  };
}

function sortColumn(sort: SortOption): string {
  switch (sort) {
    case 'favorites':
      return 'favorites';
    case 'downloads':
      return 'downloads';
    case 'views':
      return 'views';
    default:
      return 'created_at';
  }
}

export interface FetchMiisOptions {
  sort?: SortOption;
  platform?: Platform | null;
  source?: SourceFilter;
  gender?: Gender | null;
  search?: string;
  
  tagSlugs?: string[];
}

export async function fetchMiis(options: FetchMiisOptions = {}): Promise<Mii[]> {
  const {
    sort = 'newest',
    platform = null,
    source = 'all',
    gender = null,
    search = '',
    tagSlugs = [],
  } = options;

  if (sort === 'trending') {
    const { fetchTrendingMiis } = await import('@/services/discovery');
    let rows = await fetchTrendingMiis(48);
    if (gender) rows = rows.filter((m) => m.gender === gender);
    if (platform) rows = rows.filter((m) => m.platform === platform);
    const term = sanitizePostgrestSearchTerm(search);
    if (term) {
      const lower = term.toLowerCase();
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.creator_name.toLowerCase().includes(lower),
      );
    }
    return filterBlockedMiis(rows);
  }

  const col = sortColumn(sort);
  const ascending = false;

  let query = getClient()
    .from('miis')
    .select('*')
    .eq('visibility', 'public')
    .order(col, { ascending });

  if (gender) {
    query = query.eq('gender', gender);
  }

  if (source === 'tomodachi') {
    query = query.not('mii_data_download', 'is', null);
  } else if (source === '3ds') {
    query = query.eq('platform', '3ds').is('mii_data_download', null);
  } else if (source === 'wiiu') {
    query = query.eq('platform', 'wiiu');
  } else if (platform) {
    query = query.eq('platform', platform);
  }

  const term = sanitizePostgrestSearchTerm(search);
  if (term) {
    query = query.or(`name.ilike.%${term}%,creator_name.ilike.%${term}%`);
  }

  if (tagSlugs.length) {
    let ids: string[] | null = null;
    for (const slug of tagSlugs) {
      const { data: tagRow } = await getClient()
        .from('mii_tags')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!tagRow?.id) return [];
      const { data: links } = await getClient()
        .from('mii_tag_links')
        .select('mii_id')
        .eq('tag_id', tagRow.id);
      const tagMiiIds = (links ?? []).map((l) => l.mii_id as string);
      if (!tagMiiIds.length) return [];
      ids =
        ids === null
          ? tagMiiIds
          : ids.filter((id) => tagMiiIds.includes(id));
    }
    if (ids?.length) {
      query = query.in('id', ids);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((row) =>
    normalizeMii(row as Record<string, unknown>),
  );
  return filterBlockedMiis(rows);
}

let blockedUserIdsCache: { ids: Set<string>; at: number } | null = null;

async function getBlockedUserIds(): Promise<Set<string>> {
  const now = Date.now();
  if (blockedUserIdsCache && now - blockedUserIdsCache.at < 60_000) {
    return blockedUserIdsCache.ids;
  }
  try {
    const { listBlockedUsers } = await import('@/services/safety');
    const rows = await listBlockedUsers();
    const ids = new Set(rows.map((r) => r.user_id));
    blockedUserIdsCache = { ids, at: now };
    return ids;
  } catch {
    return new Set();
  }
}

async function filterBlockedMiis(miis: Mii[]): Promise<Mii[]> {
  const blocked = await getBlockedUserIds();
  if (!blocked.size) return miis;
  return miis.filter((m) => !m.user_id || !blocked.has(m.user_id));
}

export async function fetchMiiById(id: string): Promise<Mii | null> {
  const { data, error } = await getClient()
    .from('miis')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeMii(data as Record<string, unknown>);
}

export async function fetchMiisByUserId(userId: string): Promise<Mii[]> {
  const { data, error } = await getClient()
    .from('miis')
    .select('*')
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeMii(row as Record<string, unknown>));
}

export async function fetchRelatedMiis(
  mii: Mii,
  limit = 6,
): Promise<Mii[]> {
  const seen = new Set<string>([mii.id]);
  const out: Mii[] = [];

  const push = (rows: Mii[]): void => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      if (out.length >= limit) return;
    }
  };

  if (mii.user_id) {
    const { data, error } = await getClient()
      .from('miis')
      .select('*')
      .eq('user_id', mii.user_id)
      .eq('visibility', 'public')
      .neq('id', mii.id)
      .order('favorites', { ascending: false })
      .limit(limit);
    if (!error && data) {
      push(data.map((r) => normalizeMii(r as Record<string, unknown>)));
    }
  }

  if (out.length < limit) {
    const { data, error } = await getClient()
      .from('miis')
      .select('*')
      .eq('platform', mii.platform)
      .eq('visibility', 'public')
      .neq('id', mii.id)
      .order('created_at', { ascending: false })
      .limit(limit * 2);
    if (!error && data) {
      push(data.map((r) => normalizeMii(r as Record<string, unknown>)));
    }
  }

  return out.slice(0, limit);
}

function formatSupabaseError(error: unknown): string {
  const e = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };
  const message = typeof e.message === 'string' ? e.message : '';
  const details = typeof e.details === 'string' ? e.details : '';
  const hint = typeof e.hint === 'string' ? e.hint : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const msg = [message, details, hint, code === '42501' ? 'permission_denied' : '']
    .filter(Boolean)
    .join(' ');
  if (
    code === '23514' &&
    msg.toLowerCase().includes('miis_name_length')
  ) {
    return 'Mii name must be 32 characters or fewer.';
  }
  return msg.trim() || 'Request failed';
}

function formatCommentInsertError(message: string, code?: string): string {
  const lower = message.toLowerCase();
  const c = (code ?? '').toUpperCase();

  if (
    c === 'PGRST301' ||
    /\bjwt\b/i.test(message) ||
    lower.includes('jwt expired')
  ) {
    return 'Your session expired. Sign out and sign in again, then try commenting.';
  }
  if (c === '403' || c === 'PGRST103' || lower.includes('signature')) {
    return 'Comments could not be authorized. Sign out and sign in again.';
  }

  if (
    lower.includes('gamertag') ||
    lower.includes('username in profile') ||
    lower.includes('profile before commenting')
  ) {
    return 'Finish setting your ShareMii username (gamertag) in Settings, then try commenting again.';
  }
  if (
    lower.includes('cannot comment') ||
    lower.includes('comment_ban') ||
    lower.includes('full_suspend')
  ) {
    return 'Your account cannot post comments right now.';
  }

  if (
    c === '42501' ||
    lower.includes('new row violates row-level security policy') ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    return 'Comments are blocked for this resident (removed or restricted), or your session token is stale. Refresh, sign out/in, or try another Mii.';
  }
  if (lower.includes('invalid reply')) {
    return 'Could not attach this reply. Refresh the comments and try again.';
  }
  if (lower.includes('cannot comment on this mii')) {
    return 'Comments are blocked for this resident, or your session token is stale. Refresh and try again.';
  }

  if (lower.includes('foreign key')) {
    return 'Could not attach this reply. Refresh the comments and try again.';
  }
  if (lower.includes('rate limit')) {
    return 'You are commenting too quickly. Wait a moment and try again.';
  }

  const trimmed = message.trim();
  if (trimmed && trimmed.length < 220) return trimmed;
  return trimmed || 'Could not post comment.';
}

export async function insertMii(payload: InsertMiiPayload): Promise<Mii> {
  const { user_id: _ignored, ...rest } = payload;
  const row = {
    ...rest,
    name: truncateMiiName(rest.name),
    description: rest.description.trim(),
    visibility: rest.visibility ?? 'public',
    ...(rest.remix_of_mii_id != null
      ? { remix_of_mii_id: rest.remix_of_mii_id }
      : {}),
  };
  const { data, error } = await getClient()
    .from('miis')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Mii;
}

export interface StatRecordResult {
  recorded: boolean;
  reason?: string;
}

function formatStatRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('must be logged in to unyeah')) {
    return 'Sign in to remove your yeah.';
  }
  if (lower.includes('must be logged in')) {
    return 'Sign in to yeah this Mii.';
  }
  if (lower.includes('rate limit')) {
    return 'Too many requests right now. Try again later.';
  }
  if (lower.includes('invalid browser_token')) {
    return 'Could not record stat. Refresh the page and try again.';
  }
  if (lower.includes('mii not found')) {
    return 'This Mii could not be found.';
  }
  if (lower.includes('invalid stat')) {
    return 'Could not record stat.';
  }
  return message;
}

export async function incrementStat(
  id: string,
  stat: MiiStat,
): Promise<StatRecordResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await getClient().rpc('increment_mii_stat', {
      mii_id: id,
      stat,
      browser_token: getBrowserToken(),
    });
    if (!error) {
      const row = data as { recorded?: boolean; reason?: string } | null;
      return {
        recorded: Boolean(row?.recorded),
        reason: row?.reason,
      };
    }

    const msg = formatSupabaseError(error);
    if (attempt === 0 && msg.toLowerCase().includes('invalid browser_token')) {
      clearBrowserToken();
      continue;
    }
    throw new Error(formatStatRpcError(msg));
  }

  throw new Error('Could not record stat.');
}

export async function hasUserYeahedMii(miiId: string): Promise<boolean> {
  const session = await getAuthSession();
  if (!session?.user) return false;

  const { data, error } = await getClient()
    .from('mii_stat_events')
    .select('id')
    .eq('mii_id', miiId)
    .eq('stat', 'favorites')
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function removeMiiStat(
  id: string,
  stat: 'favorites',
): Promise<StatRecordResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await getClient().rpc('remove_mii_stat', {
      mii_id: id,
      stat,
      browser_token: getBrowserToken(),
    });
    if (!error) {
      const row = data as { recorded?: boolean; reason?: string } | null;
      return {
        recorded: Boolean(row?.recorded),
        reason: row?.reason,
      };
    }

    const msg = formatSupabaseError(error);
    if (attempt === 0 && msg.toLowerCase().includes('invalid browser_token')) {
      clearBrowserToken();
      continue;
    }
    throw new Error(formatStatRpcError(msg));
  }

  throw new Error('Could not remove yeah.');
}

export async function recordQrDownload(miiId: string): Promise<StatRecordResult> {
  return incrementStat(miiId, 'downloads');
}

export async function fetchComments(miiId: string): Promise<Comment[]> {
  const { data, error } = await getClient().rpc('fetch_mii_comments', {
    p_mii_id: miiId,
  });
  if (error) {
    const { data: fallback, error: fbErr } = await getClient()
      .from('comments')
      .select('*')
      .eq('mii_id', miiId)
      .eq('visibility', 'public')
      .order('created_at', { ascending: true });
    if (fbErr) throw fbErr;
    return ((fallback ?? []) as Comment[]).map((row) => ({
      ...row,
      visibility: row.visibility ?? 'public',
      parent_id: row.parent_id ?? null,
    }));
  }
  return ((data ?? []) as Comment[]).map((row) => ({
    ...(row as Comment),
    visibility: (row as Comment).visibility ?? 'public',
    parent_id: (row as Comment).parent_id ?? null,
  }));
}

export async function insertComment(
  miiId: string,
  body: string,
  parentId?: string | null,
): Promise<string> {
  const { data, error } = await getClient().rpc('submit_comment', {
    p_mii_id: miiId,
    p_body: body,
    p_parent_id: parentId ?? null,
  });
  if (error) {
    throw new Error(
      formatCommentInsertError(
        formatSupabaseError(error),
        String((error as { code?: string }).code ?? ''),
      ),
    );
  }
  return data as string;
}

export async function shadowCommentClientPolicy(
  commentId: string,
  detail: string,
): Promise<void> {
  const { error } = await getClient().rpc('client_shadow_recent_comment', {
    p_comment_id: commentId,
    p_kind: 'client_text_policy',
    p_detail: detail.slice(0, 500),
  });
  if (error) {
    console.warn(
      '[ShareMii] Could not finalize client comment moderation:',
      error.message,
    );
  }
}

export async function logProfileContentPolicyAttempt(
  field: string,
  value: string,
  reason: string,
): Promise<void> {
  const { error } = await getClient().rpc('log_profile_content_block', {
    p_field: field,
    p_value: value.slice(0, 500),
    p_reason: reason.slice(0, 500),
  });
  if (error) {
    console.warn(
      '[ShareMii] Could not log profile moderation attempt:',
      error.message,
    );
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

const MAX_PINS = 6;

function isPinnedTableMissing(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  const msg = error.message?.toLowerCase() ?? '';
  return (
    msg.includes('profile_pinned_miis') &&
    (msg.includes('does not exist') || msg.includes('could not find'))
  );
}

async function fetchPinnedMiiIds(userId: string): Promise<string[]> {
  const { data, error } = await getClient()
    .from('profile_pinned_miis')
    .select('mii_id')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) {
    if (isPinnedTableMissing(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => row.mii_id as string);
}

export async function fetchPinnedMiis(userId: string): Promise<Mii[]> {
  const ids = await fetchPinnedMiiIds(userId);
  if (!ids.length) return [];

  const { data, error } = await getClient()
    .from('miis')
    .select('*')
    .eq('visibility', 'public')
    .in('id', ids);
  if (error) throw error;

  const byId = new Map(
    (data ?? []).map((m) => [
      m.id as string,
      normalizeMii(m as Record<string, unknown>),
    ]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((m): m is Mii => m !== undefined);
}

export async function pinMii(miiId: string): Promise<void> {
  const session = await getAuthSession();
  if (!session?.user) throw new Error('Must be logged in to pin');
  const userId = session.user.id;

  const existing = await fetchPinnedMiiIds(userId);
  if (existing.includes(miiId)) return;
  if (existing.length >= MAX_PINS) {
    throw new Error('Maximum 6 pinned Miis allowed');
  }

  const usedPositions = new Set<number>();
  const { data: pinRows } = await getClient()
    .from('profile_pinned_miis')
    .select('position')
    .eq('user_id', userId);
  for (const row of pinRows ?? []) {
    usedPositions.add(row.position as number);
  }

  let position = 1;
  while (usedPositions.has(position) && position <= MAX_PINS) {
    position += 1;
  }

  const { error } = await getClient().from('profile_pinned_miis').insert({
    user_id: userId,
    mii_id: miiId,
    position,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function unpinMii(miiId: string): Promise<void> {
  const session = await getAuthSession();
  if (!session?.user) throw new Error('Must be logged in to unpin');

  const { error } = await getClient()
    .from('profile_pinned_miis')
    .delete()
    .eq('user_id', session.user.id)
    .eq('mii_id', miiId);
  if (error) throw error;
}

export async function deleteMii(id: string): Promise<void> {
  const { error } = await getClient().from('miis').delete().eq('id', id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function updateMii(
  id: string,
  payload: UpdateMiiPayload,
): Promise<Mii> {
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = truncateMiiName(payload.name);
  if (payload.description !== undefined) {
    patch.description = payload.description.trim();
  }
  if (payload.platform !== undefined) patch.platform = payload.platform;
  if (payload.gender !== undefined) patch.gender = payload.gender;
  if (payload.mii_data !== undefined) patch.mii_data = payload.mii_data;
  if (payload.mii_data_download !== undefined) {
    patch.mii_data_download = payload.mii_data_download;
  }
  if (payload.visibility !== undefined) patch.visibility = payload.visibility;

  const { data, error } = await getClient()
    .from('miis')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Mii;
}

export async function fetchUserFavoriteMiis(): Promise<Mii[]> {
  const { data: favRows, error: favError } = await getClient()
    .from('user_favorites')
    .select('mii_id, created_at')
    .order('created_at', { ascending: false });
  if (favError) throw favError;
  if (!favRows?.length) return [];

  const ids = favRows.map((r) => r.mii_id as string);
  const { data, error } = await getClient()
    .from('miis')
    .select('*')
    .eq('visibility', 'public')
    .in('id', ids);
  if (error) throw error;

  const byId = new Map(
    (data ?? []).map((m) => [
      m.id as string,
      normalizeMii(m as Record<string, unknown>),
    ]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((m): m is Mii => m !== undefined);
}

export async function isUserFavorited(miiId: string): Promise<boolean> {
  const { data, error } = await getClient()
    .from('user_favorites')
    .select('mii_id')
    .eq('mii_id', miiId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function addUserFavorite(miiId: string): Promise<void> {
  const session = await getAuthSession();
  if (!session?.user) throw new Error('Must be logged in to save favorites');

  const { error } = await getClient()
    .from('user_favorites')
    .insert({ user_id: session.user.id, mii_id: miiId });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function removeUserFavorite(miiId: string): Promise<void> {
  const session = await getAuthSession();
  if (!session?.user) throw new Error('Must be logged in');

  const { error } = await getClient()
    .from('user_favorites')
    .delete()
    .eq('user_id', session.user.id)
    .eq('mii_id', miiId);
  if (error) throw error;
}

export async function fetchNotifications(
  limit = 50,
): Promise<NotificationRow[]> {
  const { data, error } = await getClient()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as Notification[];
  if (!rows.length) return [];

  const actorIds = [
    ...new Set(rows.map((r) => r.actor_id).filter(Boolean)),
  ] as string[];
  const miiIds = [...new Set(rows.map((r) => r.mii_id))];

  const [actors, miis] = await Promise.all([
    actorIds.length
      ? getClient()
          .from('profiles')
          .select('id, username')
          .in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
    getClient().from('miis').select('id, name').in('id', miiIds),
  ]);

  if (actors.error) throw actors.error;
  if (miis.error) throw miis.error;

  const actorMap = new Map(
    (actors.data ?? []).map((p) => [p.id as string, p.username as string]),
  );
  const miiMap = new Map(
    (miis.data ?? []).map((m) => [m.id as string, m.name as string]),
  );

  return rows.map((row) => ({
    ...row,
    actor_username: row.actor_id
      ? (actorMap.get(row.actor_id) ?? 'Someone')
      : 'Someone',
    mii_name: miiMap.get(row.mii_id) ?? 'a Mii',
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await getClient()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await getClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}
