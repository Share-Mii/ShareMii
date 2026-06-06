import { getSupabaseClient } from '@/services/supabase';
import type { RateLimitStatus } from '@/types';

export async function fetchRateLimitStatus(
  action: 'comment' | 'yeah' | 'report',
): Promise<RateLimitStatus> {
  const { data, error } = await getSupabaseClient().rpc('get_rate_limit_status', {
    p_action: action,
  });
  if (error) {
    return { allowed: true, retry_after_seconds: 0 };
  }
  return data as RateLimitStatus;
}

export function formatRetryAfter(seconds: number): string {
  if (seconds <= 0) return 'a moment';
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hrs = Math.ceil(mins / 60);
  return `${hrs} hour${hrs === 1 ? '' : 's'}`;
}

export function rateLimitMessage(
  action: 'comment' | 'yeah' | 'report',
  status: RateLimitStatus,
): string {
  const wait = formatRetryAfter(status.retry_after_seconds);
  switch (action) {
    case 'comment':
      return `Comment limit reached. Try again in ${wait}.`;
    case 'yeah':
      return `Yeah limit reached. Try again in ${wait}.`;
    case 'report':
      return `Report limit reached. Try again in ${wait}.`;
    default:
      return `Please try again in ${wait}.`;
  }
}

export async function ensureRateLimitAllowed(
  action: 'comment' | 'yeah' | 'report',
): Promise<void> {
  const status = await fetchRateLimitStatus(action);
  if (!status.allowed) {
    throw new Error(rateLimitMessage(action, status));
  }
}
