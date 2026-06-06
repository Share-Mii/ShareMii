import { getSupabaseClient } from '@/services/supabase';
import type { ActivityFeedFilter } from '@/types';

export type ActivityEventType =
  | 'yeah'
  | 'submit'
  | 'remix'
  | 'comment'
  | 'collection_add';

export interface ActivityFeedItem {
  id: string;
  event_type: ActivityEventType;
  actor_id: string;
  actor_username: string | null;
  target_mii_id: string | null;
  related_mii_id: string | null;
  target_collection_id: string | null;
  comment_id: string | null;
  created_at: string;
  target_mii_name: string | null;
  related_mii_name: string | null;
  collection_name: string | null;
  target_mii_data: string | null;
  related_mii_data: string | null;
}

export interface ActivityFeedCursor {
  created_at: string;
  id: string;
}

export interface ActivityFeedResult {
  items: ActivityFeedItem[];
  nextCursor: ActivityFeedCursor | null;
}

const DEFAULT_LIMIT = 30;

function mapRow(row: Record<string, unknown>): ActivityFeedItem {
  return {
    id: row.id as string,
    event_type: row.event_type as ActivityEventType,
    actor_id: row.actor_id as string,
    actor_username: (row.actor_username as string | null) ?? null,
    target_mii_id: (row.target_mii_id as string | null) ?? null,
    related_mii_id: (row.related_mii_id as string | null) ?? null,
    target_collection_id: (row.target_collection_id as string | null) ?? null,
    comment_id: (row.comment_id as string | null) ?? null,
    created_at: row.created_at as string,
    target_mii_name: (row.target_mii_name as string | null) ?? null,
    related_mii_name: (row.related_mii_name as string | null) ?? null,
    collection_name: (row.collection_name as string | null) ?? null,
    target_mii_data: (row.target_mii_data as string | null) ?? null,
    related_mii_data: (row.related_mii_data as string | null) ?? null,
  };
}

export async function fetchActivityFeed(opts?: {
  limit?: number;
  cursor?: ActivityFeedCursor | null;
  eventFilter?: ActivityFeedFilter;
}): Promise<ActivityFeedResult> {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const cursor = opts?.cursor ?? null;
  const filter = opts?.eventFilter ?? 'all';
  const eventFilter = filter === 'all' ? null : filter;

  const { data, error } = await getSupabaseClient().rpc('fetch_activity_feed', {
    p_limit: limit,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_event_filter: eventFilter,
  });
  if (error) throw error;

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  const last = items[items.length - 1];
  const nextCursor =
    items.length >= limit && last
      ? { created_at: last.created_at, id: last.id }
      : null;

  return { items, nextCursor };
}

export async function fetchUserPublicActivity(
  userId: string,
  opts?: { limit?: number; cursor?: ActivityFeedCursor | null },
): Promise<ActivityFeedResult> {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const cursor = opts?.cursor ?? null;

  const { data, error } = await getSupabaseClient().rpc(
    'fetch_user_public_activity',
    {
      p_user_id: userId,
      p_limit: limit,
      p_cursor_created_at: cursor?.created_at ?? null,
      p_cursor_id: cursor?.id ?? null,
    },
  );
  if (error) throw error;

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  const last = items[items.length - 1];
  const nextCursor =
    items.length >= limit && last
      ? { created_at: last.created_at, id: last.id }
      : null;

  return { items, nextCursor };
}

export async function fetchFollowingCount(userId: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  if (error) throw error;
  return count ?? 0;
}
