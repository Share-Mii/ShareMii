import { getSupabaseClient } from '@/services/supabase';
import type { CreatorStats } from '@/types';

function formatError(error: { message?: string; code?: string }): string {
  return error.message ?? 'Request failed';
}

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  const code = String(error.code ?? '');
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('fetch_creator_stats') ||
    msg.includes('could not find the function')
  );
}

async function fetchCreatorStatsFallback(userId: string): Promise<CreatorStats> {
  const client = getSupabaseClient();

  const { data: miis, error: miiErr } = await client
    .from('miis')
    .select('id, favorites, views, downloads, visibility')
    .eq('user_id', userId);
  if (miiErr) throw new Error(formatError(miiErr));

  const rows = miis ?? [];
  const ownIds = rows.map((m) => m.id as string);

  let remixReceived = 0;
  if (ownIds.length) {
    const { count, error: remixErr } = await client
      .from('miis')
      .select('*', { count: 'exact', head: true })
      .in('remix_of_mii_id', ownIds)
      .eq('visibility', 'public');
    if (!remixErr) {
      remixReceived = count ?? 0;
    } else if (
      !String(remixErr.message ?? '')
        .toLowerCase()
        .includes('remix_of_mii_id')
    ) {
      throw new Error(formatError(remixErr));
    }
  }

  const [{ count: followerCount, error: fErr }, { count: followingCount, error: gErr }] =
    await Promise.all([
      client
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      client
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);
  if (fErr) throw new Error(formatError(fErr));
  if (gErr) throw new Error(formatError(gErr));

  return {
    upload_count: rows.length,
    public_upload_count: rows.filter((m) => m.visibility === 'public').length,
    total_yeahs: rows.reduce((n, m) => n + Number(m.favorites ?? 0), 0),
    total_views: rows.reduce((n, m) => n + Number(m.views ?? 0), 0),
    total_downloads: rows.reduce((n, m) => n + Number(m.downloads ?? 0), 0),
    remix_received_count: remixReceived,
    follower_count: followerCount ?? 0,
    following_count: followingCount ?? 0,
  };
}

export async function fetchCreatorStats(
  userId?: string,
): Promise<CreatorStats> {
  const client = getSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const uid = userId ?? user?.id;
  if (!uid) throw new Error('Must be logged in');

  const { data, error } = await client.rpc('fetch_creator_stats', {
    p_user_id: userId ?? null,
  });

  if (!error && data) {
    return data as CreatorStats;
  }

  if (error && isMissingRpcError(error)) {
    return fetchCreatorStatsFallback(uid);
  }

  if (error) throw new Error(formatError(error));
  return fetchCreatorStatsFallback(uid);
}
