import type { Session, User } from '@supabase/supabase-js';
import {
  cacheProfileUsername,
  clearProfileCache,
  getCachedUsername,
  loadUsernameForUser,
} from '@/services/profile';
import { getSupabaseClient } from '@/services/supabase';
import { clearStaffCache } from '@/services/staffGate';

type AuthListener = (session: Session | null) => void;

const listeners = new Set<AuthListener>();
let authReady = false;
let primedSession: Session | null | undefined;

export function getPrimedAuthSession(): Session | null | undefined {
  return primedSession;
}

export async function initAuth(): Promise<Session | null> {
  if (primedSession !== undefined) {
    return primedSession;
  }
  ensureAuthListener();
  const { data } = await getSupabaseClient().auth.getSession();
  primedSession = data.session ?? null;
  if (primedSession?.user) {
    void loadUsernameForUser(primedSession.user.id).then((name) => {
      if (name) cacheProfileUsername(primedSession!.user!.id, name);
    });
  }
  return primedSession;
}

export const AUTH_REDIRECT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://sharemii.net',
  'https://www.sharemii.net',
] as const;

export function getAuthRedirectUrl(): string {
  const { origin, pathname, search, hash } = window.location;
  const base = AUTH_REDIRECT_ORIGINS.includes(
    origin as (typeof AUTH_REDIRECT_ORIGINS)[number],
  )
    ? origin
    : 'https://sharemii.net';
  return `${base}${pathname || '/'}${search}${hash || '#/'}`;
}

function notify(session: Session | null): void {
  for (const listener of listeners) {
    listener(session);
  }
}

function ensureAuthListener(): void {
  if (authReady) return;
  authReady = true;
  getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    primedSession = session ?? null;
    if (!session?.user) {
      clearProfileCache();
      clearStaffCache();
    } else {
      void loadUsernameForUser(session.user.id).then((name) => {
        if (name) cacheProfileUsername(session.user.id, name);
      });
    }
    notify(session);
  });
}

export function subscribeAuth(listener: AuthListener): () => void {
  ensureAuthListener();
  listeners.add(listener);
  void getSupabaseClient()
    .auth.getSession()
    .then(({ data }) => listener(data.session));
  return () => listeners.delete(listener);
}

export async function getAuthSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session;
}

export function isLoggedIn(session: Session | null): boolean {
  return Boolean(session?.user);
}

export function getDisplayName(user: User): string {
  const cached = getCachedUsername(user.id);
  if (cached) return cached;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (typeof meta?.display_name === 'string' && meta.display_name) ||
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.name === 'string' && meta.name);
  if (name) return name;
  if (user.email) return user.email.split('@')[0] ?? 'User';
  return 'User';
}

export async function getDisplayNameAsync(user: User): Promise<string> {
  const profileName = await loadUsernameForUser(user.id);
  if (profileName) return profileName;
  return getDisplayName(user);
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<string | null> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });
  return error?.message ?? null;
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) return { error: error.message, needsConfirmation: false };
  const needsConfirmation = Boolean(data.user) && !data.session;
  return { error: null, needsConfirmation };
}

export async function resetPassword(email: string): Promise<string | null> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
  return error?.message ?? null;
}

export type OAuthProvider = 'google' | 'github' | 'discord';

export async function signInWithProvider(
  provider: OAuthProvider,
): Promise<string | null> {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: getAuthRedirectUrl() },
  });
  return error?.message ?? null;
}

export async function signOut(): Promise<string | null> {
  const { error } = await getSupabaseClient().auth.signOut();
  return error?.message ?? null;
}
