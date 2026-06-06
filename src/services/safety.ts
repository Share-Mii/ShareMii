import { getSupabaseClient } from '@/services/supabase';
import type { ContentAppeal } from '@/types';

function formatError(error: { message?: string }): string {
  return error.message ?? 'Request failed';
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('block_user', {
    p_blocked_id: userId,
  });
  if (error) throw new Error(formatError(error));
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('unblock_user', {
    p_blocked_id: userId,
  });
  if (error) throw new Error(formatError(error));
}

export async function muteUser(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mute_user', {
    p_muted_id: userId,
  });
  if (error) throw new Error(formatError(error));
}

export async function unmuteUser(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('unmute_user', {
    p_muted_id: userId,
  });
  if (error) throw new Error(formatError(error));
}

export async function listBlockedUsers(): Promise<
  { user_id: string; username: string; blocked_at: string }[]
> {
  const { data, error } = await getSupabaseClient().rpc('list_blocked_users');
  if (error) throw new Error(formatError(error));
  return (data ?? []) as { user_id: string; username: string; blocked_at: string }[];
}

export async function submitContentAppeal(
  targetType: 'mii' | 'comment' | 'profile',
  targetId: string,
  reason = '',
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('submit_content_appeal', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
  });
  if (error) throw new Error(formatError(error));
  return data as string;
}

export async function adminListAppeals(
  status: 'open' | 'approved' | 'denied' = 'open',
  limit = 50,
  offset = 0,
): Promise<ContentAppeal[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_appeals', {
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(formatError(error));
  return (data ?? []) as ContentAppeal[];
}

export async function adminResolveAppeal(
  appealId: string,
  status: 'approved' | 'denied',
  staffNote = '',
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_resolve_appeal', {
    p_appeal_id: appealId,
    p_status: status,
    p_staff_note: staffNote,
  });
  if (error) throw new Error(formatError(error));
}
