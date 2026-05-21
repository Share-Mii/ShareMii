import { getAuthSession, isLoggedIn } from '@/services/auth';
import { checkIsAdmin, checkIsStaff } from '@/services/admin';
import { fetchProfileById } from '@/services/profile';
import { isAdmin, isStaff } from '@/utils/permissions';
import type { Profile } from '@/types';

let cachedStaffProfile: Profile | null | undefined;

export function clearStaffCache(): void {
  cachedStaffProfile = undefined;
}

export async function loadStaffProfile(): Promise<Profile | null> {
  const session = await getAuthSession();
  if (!isLoggedIn(session)) {
    cachedStaffProfile = null;
    return null;
  }

  const profile = await fetchProfileById(session!.user.id);
  cachedStaffProfile = profile;
  return profile;
}

export async function requireStaffProfile(): Promise<Profile | null> {
  const profile = await loadStaffProfile();
  if (!profile || !isStaff(profile)) return null;

  const staffOk = await checkIsStaff();
  if (!staffOk) return null;

  return profile;
}

export async function requireAdminProfile(): Promise<Profile | null> {
  const profile = await requireStaffProfile();
  if (!profile || !isAdmin(profile)) return null;

  const adminOk = await checkIsAdmin();
  if (!adminOk) return null;

  return profile;
}

export function getCachedStaffProfile(): Profile | null | undefined {
  return cachedStaffProfile;
}
