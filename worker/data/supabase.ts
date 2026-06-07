export interface WorkerEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SITE_ORIGIN?: string;
  DISCORD_INVITE_URL?: string;
}

async function supabaseFetch<T>(
  env: WorkerEnv,
  path: string,
): Promise<T | null> {
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export interface MiiRow {
  id: string;
  name: string;
  description: string | null;
  mii_data: string;
  creator_name: string | null;
  visibility: string;
}

export async function fetchPublicMii(
  env: WorkerEnv,
  id: string,
): Promise<MiiRow | null> {
  const rows = await supabaseFetch<MiiRow[]>(
    env,
    `miis?id=eq.${encodeURIComponent(id)}&visibility=eq.public&select=id,name,description,mii_data,creator_name,visibility&limit=1`,
  );
  return rows?.[0] ?? null;
}

export interface ProfileRow {
  username: string;
  bio: string | null;
  profile_hidden: boolean;
}

export async function fetchPublicProfile(
  env: WorkerEnv,
  username: string,
): Promise<ProfileRow | null> {
  const rows = await supabaseFetch<ProfileRow[]>(
    env,
    `profiles?username=eq.${encodeURIComponent(username)}&profile_hidden=eq.false&select=username,bio,profile_hidden&limit=1`,
  );
  return rows?.[0] ?? null;
}

export interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
}

export async function fetchPublicCollection(
  env: WorkerEnv,
  id: string,
): Promise<CollectionRow | null> {
  const rows = await supabaseFetch<CollectionRow[]>(
    env,
    `mii_collections?id=eq.${encodeURIComponent(id)}&is_public=eq.true&select=id,name,description,is_public&limit=1`,
  );
  return rows?.[0] ?? null;
}

export interface TagRow {
  slug: string;
  label: string;
}

export async function fetchTag(
  env: WorkerEnv,
  slug: string,
): Promise<TagRow | null> {
  const rows = await supabaseFetch<TagRow[]>(
    env,
    `mii_tags?slug=eq.${encodeURIComponent(slug)}&select=slug,label&limit=1`,
  );
  return rows?.[0] ?? null;
}

export interface FeaturedMiiRow {
  id: string;
  name: string;
}

export async function fetchFeaturedMiis(
  env: WorkerEnv,
  limit = 8,
): Promise<FeaturedMiiRow[]> {
  const rows = await supabaseFetch<FeaturedMiiRow[]>(
    env,
    `miis?visibility=eq.public&select=id,name&order=favorites.desc&limit=${limit}`,
  );
  return rows ?? [];
}

export interface TagListRow {
  slug: string;
  label: string;
}

export async function fetchAllTags(env: WorkerEnv): Promise<TagListRow[]> {
  const rows = await supabaseFetch<TagListRow[]>(
    env,
    'mii_tags?select=slug,label&order=label.asc&limit=500',
  );
  return rows ?? [];
}

export interface SitemapIds {
  miis: { id: string; created_at?: string; updated_at?: string }[];
  profiles: { username: string; updated_at?: string }[];
  tags: { slug: string; created_at?: string }[];
  collections: {
    id: string;
    created_at?: string;
    updated_at?: string;
  }[];
}

export async function fetchSitemapIds(env: WorkerEnv): Promise<SitemapIds> {
  const empty: SitemapIds = {
    miis: [],
    profiles: [],
    tags: [],
    collections: [],
  };
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) return empty;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };

  const [miis, profiles, tags, collections] = await Promise.all([
    fetch(
      `${base}/rest/v1/miis?visibility=eq.public&select=id,created_at,updated_at&order=created_at.desc&limit=5000`,
      { headers },
    ),
    fetch(
      `${base}/rest/v1/profiles?profile_hidden=eq.false&select=username,updated_at&limit=2000`,
      { headers },
    ),
    fetch(
      `${base}/rest/v1/mii_tags?select=slug,created_at&limit=500`,
      { headers },
    ),
    fetch(
      `${base}/rest/v1/mii_collections?is_public=eq.true&select=id,created_at,updated_at&limit=1000`,
      { headers },
    ),
  ]);

  return {
    miis: miis.ok ? ((await miis.json()) as SitemapIds['miis']) : [],
    profiles: profiles.ok
      ? ((await profiles.json()) as SitemapIds['profiles'])
      : [],
    tags: tags.ok ? ((await tags.json()) as SitemapIds['tags']) : [],
    collections: collections.ok
      ? ((await collections.json()) as SitemapIds['collections'])
      : [],
  };
}
