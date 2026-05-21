import type {
  NotificationPreferences,
  Profile,
  UpdateProfilePayload,
} from '@/types';
import { getSupabaseClient } from '@/services/supabase';
import {
  compressProfileImage,
  PROFILE_IMAGE_SOURCE_MAX_BYTES,
} from '@/utils/compressImage';
import {
  normalizeGamertag,
  validateGamertag,
} from '@/utils/gamertag';

const BUCKET = 'profile-media';

const PROFILE_SELECT_BASE =
  'id, username, username_normalized, bio, avatar_url, banner_url, profile_hidden, trusted_creator, created_at, updated_at';

let profilePrivateResourceMissing = false;

function isProfilePrivateMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; details?: string };
  const code = String(e.code ?? '').toUpperCase();
  const text = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
  if (code === '42P01' && text.includes('profile_private')) return true;
  if (text.includes('profile_private') && text.includes('does not exist'))
    return true;
  const blob = JSON.stringify(err).toLowerCase();
  if (blob.includes('profile_private') && blob.includes('42p01')) return true;
  return false;
}

async function fetchProfilePrivateFields(
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (profilePrivateResourceMissing) return null;

  const { data, error } = await getSupabaseClient()
    .from('profile_private')
    .select('role, notify_comments, notify_yeahs, notify_favorites')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isProfilePrivateMissingError(error)) {
      profilePrivateResourceMissing = true;
      if (import.meta.env.DEV) {
        console.warn(
          '[ShareMii] profile_private is missing from the API schema. Apply migration 020_profile_private.sql (supabase db push).',
        );
      }
    }
    return null;
  }
  if (!data) return null;
  return data as Record<string, unknown>;
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const BANNER_MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type ProfileImageKind = 'avatar' | 'banner';

function formatError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  if (error.code === '23505') {
    return 'This gamertag is already taken.';
  }
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.join(' ') || 'Request failed';
}

export function hasCompletedProfile(profile: Profile | null): boolean {
  return Boolean(profile?.username?.trim());
}

export async function ensureProfile(userId: string): Promise<Profile> {
  const existing = await fetchProfileById(userId);
  if (existing) return existing;

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .insert({ id: userId })
    .select(PROFILE_SELECT_BASE)
    .single();

  if (error) {
    const retry = await fetchProfileById(userId);
    if (retry) return retry;
    throw new Error(formatError(error));
  }

  const priv = await fetchProfilePrivateFields(userId);
  return normalizeProfile({
    ...(data as Record<string, unknown>),
    profile_private: priv,
  });
}

function normalizeProfile(row: Record<string, unknown>): Profile {
  const { profile_private: rawPriv, ...rest } = row;
  const priv = rawPriv as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const p = Array.isArray(priv) ? priv[0] : priv;

  const usernameNormalized =
    (typeof rest.username_normalized === 'string' ||
      rest.username_normalized === null)
      ? (rest.username_normalized as string | null)
      : null;

  const avatarUrl =
    typeof rest.avatar_url === 'string'
      ? rest.avatar_url
      : typeof rest.avatar_url !== 'undefined' && rest.avatar_url !== null
        ? String(rest.avatar_url)
        : null;

  const bannerUrl =
    typeof rest.banner_url === 'string'
      ? rest.banner_url
      : typeof rest.banner_url !== 'undefined' && rest.banner_url !== null
        ? String(rest.banner_url)
        : null;

  return {
    id: rest.id as string,
    username: (typeof rest.username === 'string' ? rest.username : '') ?? '',
    username_normalized: usernameNormalized,
    bio: typeof rest.bio === 'string' ? rest.bio : '',
    avatar_url: avatarUrl,
    banner_url: bannerUrl,
    notify_comments:
      typeof p?.notify_comments === 'boolean' ? p.notify_comments : true,
    notify_yeahs: typeof p?.notify_yeahs === 'boolean' ? p.notify_yeahs : true,
    notify_favorites:
      typeof p?.notify_favorites === 'boolean' ? p.notify_favorites : true,
    role: (typeof p?.role === 'string' ? (p.role as Profile['role']) : undefined) ?? 'user',
    profile_hidden: Boolean(rest.profile_hidden),
    trusted_creator: Boolean(rest.trusted_creator),
    created_at:
      typeof rest.created_at === 'string'
        ? rest.created_at
        : String(rest.created_at ?? ''),
    updated_at:
      typeof rest.updated_at === 'string'
        ? rest.updated_at
        : String(rest.updated_at ?? ''),
  };
}

export async function fetchProfileById(
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select(PROFILE_SELECT_BASE)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(formatError(error));
  if (!data) return null;

  const priv = await fetchProfilePrivateFields(userId);
  return normalizeProfile({
    ...(data as Record<string, unknown>),
    profile_private: priv,
  });
}

export async function fetchProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const normalized = normalizeGamertag(username);
  if (!normalized) return null;

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select(PROFILE_SELECT_BASE)
    .eq('username_normalized', normalized)
    .maybeSingle();

  if (error) throw new Error(formatError(error));
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const priv = id ? await fetchProfilePrivateFields(id) : null;
  return normalizeProfile({ ...row, profile_private: priv });
}

export async function updateProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<Profile> {
  await ensureProfile(userId);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.bio !== undefined) {
    patch.bio = payload.bio.trim().slice(0, 500);
  }

  if (payload.username !== undefined) {
    const validation = validateGamertag(payload.username);
    if (!validation.ok) {
      throw new Error(validation.error ?? 'Invalid gamertag');
    }
    const trimmed = payload.username.trim();
    patch.username = trimmed;
    patch.username_normalized = normalizeGamertag(trimmed);
  }

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_SELECT_BASE)
    .single();

  if (error) throw new Error(formatError(error));
  const priv = await fetchProfilePrivateFields(userId);
  return normalizeProfile({
    ...(data as Record<string, unknown>),
    profile_private: priv,
  });
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Use a JPEG, PNG, or WebP image.';
  }
  if (file.size > PROFILE_IMAGE_SOURCE_MAX_BYTES) {
    return 'Image must be 12 MB or smaller.';
  }
  return null;
}

export async function uploadProfileImage(
  userId: string,
  kind: ProfileImageKind,
  file: File,
): Promise<Profile> {
  const fileError = validateImageFile(file);
  if (fileError) throw new Error(fileError);

  await ensureProfile(userId);

  const maxBytes = kind === 'avatar' ? AVATAR_MAX_BYTES : BANNER_MAX_BYTES;
  const compressed = await compressProfileImage(file, kind, maxBytes);
  if (compressed.size > maxBytes) {
    throw new Error(
      kind === 'avatar'
        ? 'Avatar is still too large after compression. Try a smaller image.'
        : 'Banner is still too large after compression. Try a smaller image.',
    );
  }

  const ext = extFromMime(compressed.type);
  const path = `${userId}/${kind}.${ext}`;

  const { error: uploadError } = await getSupabaseClient()
    .storage.from(BUCKET)
    .upload(path, compressed, {
      upsert: true,
      contentType: compressed.type,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = getSupabaseClient()
    .storage.from(BUCKET)
    .getPublicUrl(path);

  const url = `${urlData.publicUrl}?t=${Date.now()}`;
  const field = kind === 'avatar' ? 'avatar_url' : 'banner_url';

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update({
      [field]: url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(PROFILE_SELECT_BASE)
    .single();

  if (error) throw new Error(formatError(error));
  const priv = await fetchProfilePrivateFields(userId);
  return normalizeProfile({
    ...(data as Record<string, unknown>),
    profile_private: priv,
  });
}

const usernameCache = new Map<string, string>();

export function cacheProfileUsername(userId: string, username: string): void {
  if (username.trim()) {
    usernameCache.set(userId, username.trim());
  }
}

export function getCachedUsername(userId: string): string | undefined {
  return usernameCache.get(userId);
}

export function clearProfileCache(): void {
  usernameCache.clear();
  profilePrivateResourceMissing = false;
}

export async function fetchNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const profile = await fetchProfileById(userId);
  return {
    notify_comments: profile?.notify_comments ?? true,
    notify_yeahs: profile?.notify_yeahs ?? true,
    notify_favorites: profile?.notify_favorites ?? true,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<Profile> {
  await ensureProfile(userId);

  const patch: Record<string, unknown> = {};

  if (prefs.notify_comments !== undefined) {
    patch.notify_comments = prefs.notify_comments;
  }
  if (prefs.notify_yeahs !== undefined) {
    patch.notify_yeahs = prefs.notify_yeahs;
  }
  if (prefs.notify_favorites !== undefined) {
    patch.notify_favorites = prefs.notify_favorites;
  }

  if (Object.keys(patch).length === 0) {
    const p = await fetchProfileById(userId);
    if (p) return p;
    throw new Error('Profile not found');
  }

  const { error } = await getSupabaseClient()
    .from('profile_private')
    .update(patch)
    .eq('user_id', userId);

  if (error) throw new Error(formatError(error));

  const refreshed = await fetchProfileById(userId);
  if (refreshed) return refreshed;
  throw new Error('Profile not found after update');
}

export async function loadUsernameForUser(userId: string): Promise<string | null> {
  const cached = usernameCache.get(userId);
  if (cached) return cached;

  const profile = await fetchProfileById(userId);
  if (profile?.username?.trim()) {
    usernameCache.set(userId, profile.username.trim());
    return profile.username.trim();
  }
  return null;
}
