import { getSupabaseClient } from '@/services/supabase';
import type {
  FollowSuggestion,
  Mii,
  ProfileSearchResult,
  PublicCollectionSummary,
} from '@/types';

function formatError(error: { message?: string }): string {
  return error.message ?? 'Request failed';
}

function normalizeMii(row: Record<string, unknown>): Mii {
  return row as unknown as Mii;
}

export async function fetchTrendingMiis(limit = 24): Promise<Mii[]> {
  const { data, error } = await getSupabaseClient().rpc('fetch_trending_miis', {
    p_limit: limit,
  });
  if (error) throw new Error(formatError(error));
  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeMii(row),
  );
}

export async function fetchRandomMii(): Promise<Mii | null> {
  const { data, error } = await getSupabaseClient().rpc('fetch_random_mii');
  if (error) throw new Error(formatError(error));
  if (!data) return null;
  return normalizeMii(data as Record<string, unknown>);
}

export async function searchProfiles(
  query: string,
  limit = 20,
): Promise<ProfileSearchResult[]> {
  const { data, error } = await getSupabaseClient().rpc('search_profiles', {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw new Error(formatError(error));
  return (data ?? []) as ProfileSearchResult[];
}

export async function fetchRemixSource(miiId: string): Promise<Mii | null> {
  const { data, error } = await getSupabaseClient().rpc('fetch_remix_source', {
    p_mii_id: miiId,
  });
  if (error) throw new Error(formatError(error));
  if (!data) return null;
  return normalizeMii(data as Record<string, unknown>);
}

export async function fetchRemixChildren(
  miiId: string,
  limit = 12,
): Promise<Mii[]> {
  const { data, error } = await getSupabaseClient().rpc('fetch_remix_children', {
    p_mii_id: miiId,
    p_limit: limit,
  });
  if (error) throw new Error(formatError(error));
  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeMii(row),
  );
}

export async function fetchFollowSuggestions(
  limit = 8,
): Promise<FollowSuggestion[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'fetch_follow_suggestions',
    { p_limit: limit },
  );
  if (error) throw new Error(formatError(error));
  return (data ?? []) as FollowSuggestion[];
}

export async function fetchPublicCollections(
  limit = 24,
  offset = 0,
): Promise<PublicCollectionSummary[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'fetch_public_collections',
    { p_limit: limit, p_offset: offset },
  );
  if (error) throw new Error(formatError(error));
  return (data ?? []) as PublicCollectionSummary[];
}
