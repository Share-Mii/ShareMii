import { openUsernameSetupModal } from '@/components/UsernameSetupModal/UsernameSetupModal';
import { getAuthSession, isLoggedIn, subscribeAuth } from '@/services/auth';
import {
  fetchProfileById,
  hasCompletedProfile,
} from '@/services/profile';

let gateStarted = false;

export function initProfileGate(): void {
  if (gateStarted) return;
  gateStarted = true;

  const check = async (): Promise<void> => {
    const session = await getAuthSession();
    if (!isLoggedIn(session)) return;

    const profile = await fetchProfileById(session!.user.id);
    if (!hasCompletedProfile(profile)) {
      openUsernameSetupModal({ blocking: true });
    }
  };

  subscribeAuth(() => {
    void check();
  });
  void check();
}

export async function requireGamertag(): Promise<boolean> {
  const session = await getAuthSession();
  if (!isLoggedIn(session)) return false;

  const profile = await fetchProfileById(session!.user.id);
  if (hasCompletedProfile(profile)) return true;

  return new Promise((resolve) => {
    openUsernameSetupModal({
      blocking: true,
      onComplete: () => resolve(true),
    });
  });
}
