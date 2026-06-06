import { getSupabaseClient } from '@/services/supabase';
import type { Mii } from '@/types';
import { sanitizePostgrestSearchTerm } from '@/utils/escapeHtml';

function mapMii(row: Record<string, unknown>): Mii {
  return {
    ...(row as unknown as Mii),
    visibility: (row.visibility as Mii['visibility']) ?? 'public',
    hidden_reason: (row.hidden_reason as string | null) ?? null,
  };
}

export interface MiiTag {
  id: string;
  slug: string;
  label: string;
}

export interface MiiCollection {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
  item_count?: number;
}

export interface CollectionFormInput {
  name: string;
  description?: string;
  isPublic: boolean;
}

export async function fetchMiiTags(): Promise<MiiTag[]> {
  const { data, error } = await getSupabaseClient()
    .from('mii_tags')
    .select('*')
    .order('label');
  if (error) throw error;
  return (data ?? []) as MiiTag[];
}

export async function searchMiiTags(
  query: string,
  limit = 12,
): Promise<MiiTag[]> {
  const term = sanitizePostgrestSearchTerm(query.trim());
  if (!term) return [];

  const { data, error } = await getSupabaseClient()
    .from('mii_tags')
    .select('*')
    .or(`label.ilike.%${term}%,slug.ilike.%${term}%`)
    .order('label')
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MiiTag[];
}

export async function fetchTagsForMii(miiId: string): Promise<MiiTag[]> {
  const { data, error } = await getSupabaseClient()
    .from('mii_tag_links')
    .select('tag_id, mii_tags(id, slug, label)')
    .eq('mii_id', miiId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const joined = row as { mii_tags: MiiTag | MiiTag[] | null };
      const tag = joined.mii_tags;
      return Array.isArray(tag) ? tag[0] : tag;
    })
    .filter((t): t is MiiTag => Boolean(t));
}

export async function setMiiTags(miiId: string, tagIds: string[]): Promise<void> {
  const client = getSupabaseClient();
  await client.from('mii_tag_links').delete().eq('mii_id', miiId);
  if (!tagIds.length) return;
  const { error } = await client.from('mii_tag_links').insert(
    tagIds.map((tag_id) => ({ mii_id: miiId, tag_id })),
  );
  if (error) throw error;
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function followUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('user_follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export const HOME_FOLLOWING_SLOTS = 8;

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** One Mii per creator when possible; fills remaining slots from the pool if needed. */
export function pickDiverseFollowingMiis(
  miis: Mii[],
  slotCount: number,
): Mii[] {
  if (!miis.length || slotCount < 1) return [];

  const byCreator = new Map<string, Mii[]>();
  for (const mii of miis) {
    const uid = mii.user_id;
    if (!uid) continue;
    const list = byCreator.get(uid) ?? [];
    list.push(mii);
    byCreator.set(uid, list);
  }

  const selected: Mii[] = [];
  const usedMiiIds = new Set<string>();

  for (const creatorId of shuffleInPlace([...byCreator.keys()])) {
    if (selected.length >= slotCount) break;
    const pool = byCreator.get(creatorId);
    if (!pool?.length) continue;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    if (usedMiiIds.has(pick.id)) continue;
    selected.push(pick);
    usedMiiIds.add(pick.id);
  }

  if (selected.length < slotCount) {
    const rest = shuffleInPlace(miis.filter((m) => !usedMiiIds.has(m.id)));
    for (const mii of rest) {
      if (selected.length >= slotCount) break;
      selected.push(mii);
      usedMiiIds.add(mii.id);
    }
  }

  return shuffleInPlace(selected);
}

async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data: follows, error: fErr } = await getSupabaseClient()
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (fErr) throw fErr;
  return (follows ?? []).map((r) => r.following_id as string);
}

export async function fetchFollowingFeedMiis(
  userId: string,
  limit = 24,
): Promise<Mii[]> {
  const ids = await fetchFollowingIds(userId);
  if (!ids.length) return [];

  const { data, error } = await getSupabaseClient()
    .from('miis')
    .select('*')
    .in('user_id', ids)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => mapMii(row as Record<string, unknown>));
}

/** Home strip: one row of Miis from random followed creators (unique per slot when possible). */
export async function fetchHomeFollowingMiis(
  userId: string,
  slotCount = HOME_FOLLOWING_SLOTS,
): Promise<Mii[]> {
  const ids = await fetchFollowingIds(userId);
  if (!ids.length) return [];

  const poolLimit = Math.max(80, slotCount * 20);
  const { data, error } = await getSupabaseClient()
    .from('miis')
    .select('*')
    .in('user_id', ids)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(poolLimit);
  if (error) throw error;
  const pool = (data ?? []).map((row) => mapMii(row as Record<string, unknown>));
  return pickDiverseFollowingMiis(pool, slotCount);
}

function mapCollectionRow(
  row: Record<string, unknown>,
): MiiCollection {
  const items = row.mii_collection_items as { count: number }[] | undefined;
  const count =
    items?.[0]?.count ??
    (typeof row.item_count === 'number' ? row.item_count : undefined);
  const { mii_collection_items: _items, ...rest } = row;
  return {
    ...(rest as unknown as MiiCollection),
    item_count: count,
  };
}

export async function fetchUserCollections(
  userId: string,
): Promise<MiiCollection[]> {
  const { data, error } = await getSupabaseClient()
    .from('mii_collections')
    .select('*, mii_collection_items(count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapCollectionRow(row as Record<string, unknown>),
  );
}

export async function fetchPublicCollectionsForUser(
  userId: string,
): Promise<MiiCollection[]> {
  const { data, error } = await getSupabaseClient()
    .from('mii_collections')
    .select('*, mii_collection_items(count)')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) =>
    mapCollectionRow(row as Record<string, unknown>),
  );
}

export async function fetchCollectionById(
  id: string,
): Promise<MiiCollection | null> {
  const { data, error } = await getSupabaseClient()
    .from('mii_collections')
    .select('*, mii_collection_items(count)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapCollectionRow(data as Record<string, unknown>);
}

export async function createCollection(
  userId: string,
  input: CollectionFormInput,
): Promise<MiiCollection> {
  const { data, error } = await getSupabaseClient()
    .from('mii_collections')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: (input.description ?? '').trim(),
      is_public: input.isPublic,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MiiCollection;
}

export async function updateCollection(
  collectionId: string,
  input: Partial<CollectionFormInput>,
): Promise<MiiCollection> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.isPublic !== undefined) patch.is_public = input.isPublic;

  const { data, error } = await getSupabaseClient()
    .from('mii_collections')
    .update(patch)
    .eq('id', collectionId)
    .select()
    .single();
  if (error) throw error;
  return data as MiiCollection;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('mii_collections')
    .delete()
    .eq('id', collectionId);
  if (error) throw error;
}

export async function fetchCollectionPreviewMiis(
  collectionId: string,
  limit = 3,
  options?: { viewerIsOwner?: boolean },
): Promise<Mii[]> {
  const { data, error } = await getSupabaseClient()
    .from('mii_collection_items')
    .select('position, miis(*)')
    .eq('collection_id', collectionId)
    .order('position', { ascending: true })
    .order('added_at', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const miis = (data ?? [])
    .map((row) => {
      const joined = row as {
        miis: Record<string, unknown> | Record<string, unknown>[] | null;
      };
      const mii = joined.miis;
      return Array.isArray(mii) ? mii[0] : mii;
    })
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => mapMii(row));

  if (options?.viewerIsOwner) return miis;
  return miis.filter((m) => m.visibility === 'public');
}

export async function fetchCollectionMiis(
  collectionId: string,
  options?: { viewerIsOwner?: boolean },
): Promise<Mii[]> {
  const { data, error } = await getSupabaseClient()
    .from('mii_collection_items')
    .select('position, miis(*)')
    .eq('collection_id', collectionId)
    .order('position', { ascending: true })
    .order('added_at', { ascending: true });
  if (error) throw error;

  const miis = (data ?? [])
    .map((row) => {
      const joined = row as {
        miis: Record<string, unknown> | Record<string, unknown>[] | null;
      };
      const mii = joined.miis;
      return Array.isArray(mii) ? mii[0] : mii;
    })
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => mapMii(row));

  if (options?.viewerIsOwner) return miis;
  return miis.filter((m) => m.visibility === 'public');
}

export async function fetchCollectionIdsForMii(
  userId: string,
  miiId: string,
): Promise<Set<string>> {
  const { data: collections, error: cErr } = await getSupabaseClient()
    .from('mii_collections')
    .select('id')
    .eq('user_id', userId);
  if (cErr) throw cErr;
  const ids = (collections ?? []).map((c) => c.id as string);
  if (!ids.length) return new Set();

  const { data, error } = await getSupabaseClient()
    .from('mii_collection_items')
    .select('collection_id')
    .eq('mii_id', miiId)
    .in('collection_id', ids);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.collection_id as string));
}

export async function addMiiToCollection(
  collectionId: string,
  miiId: string,
  position?: number,
): Promise<void> {
  let pos = position;
  if (pos === undefined) {
    const { count, error: countErr } = await getSupabaseClient()
      .from('mii_collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);
    if (countErr) throw countErr;
    pos = count ?? 0;
  }

  const { error } = await getSupabaseClient()
    .from('mii_collection_items')
    .upsert({ collection_id: collectionId, mii_id: miiId, position: pos });
  if (error) throw error;

  await getSupabaseClient()
    .from('mii_collections')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', collectionId);
}

export async function removeMiiFromCollection(
  collectionId: string,
  miiId: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('mii_collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('mii_id', miiId);
  if (error) throw error;

  await getSupabaseClient()
    .from('mii_collections')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', collectionId);
}
