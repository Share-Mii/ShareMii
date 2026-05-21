import type { Profile, UserRole } from '@/types';

export function isStaffRole(role: UserRole | undefined | null): boolean {
  return role === 'moderator' || role === 'admin';
}

export function isAdminRole(role: UserRole | undefined | null): boolean {
  return role === 'admin';
}

export function isStaff(profile: Profile | null | undefined): boolean {
  return isStaffRole(profile?.role);
}

export function isAdmin(profile: Profile | null | undefined): boolean {
  return isAdminRole(profile?.role);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    default:
      return 'User';
  }
}
