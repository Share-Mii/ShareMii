import { renderHome } from '@/pages/Home';
import { renderDetail } from '@/pages/Detail';
import { renderBrowse } from '@/pages/Browse';
import { renderCreate } from '@/pages/Create';
import { fetchMiiById } from '@/services/supabase';
import { renderProfile } from '@/pages/Profile';
import { renderFavorites } from '@/pages/Favorites';
import { renderCollections } from '@/pages/Collections';
import { renderCollectionDetail } from '@/pages/CollectionDetail';
import { renderUploads } from '@/pages/Uploads';
import { renderSettings } from '@/pages/Settings';
import {
  ensureProfile,
  fetchProfileById,
  hasCompletedProfile,
} from '@/services/profile';
import { isLegalPageId, renderLegal } from '@/pages/Legal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { requireGamertag } from '@/services/profileGate';
import {
  closeScanAndSubmit,
  initScanSubmitTriggers,
  openScanAndSubmit,
} from '@/services/scanSubmit';
import { scrollToTop } from '@/utils/scroll';
import { runPageEnter } from '@/utils/reveal';
import { resetPageMeta } from '@/utils/pageMeta';
import { validateGamertag } from '@/utils/gamertag';
import { renderAdminDashboard } from '@/pages/admin/Dashboard';
import { renderAdminReports } from '@/pages/admin/Reports';
import { renderAdminModerationQueue } from '@/pages/admin/ModerationQueue';
import { renderAdminReportDetail } from '@/pages/admin/ReportDetail';
import { renderAdminUsers } from '@/pages/admin/Users';
import { renderAdminAudit } from '@/pages/admin/Audit';
import { renderAdminSettings } from '@/pages/admin/AdminSettings';
import { requireAdminProfile, requireStaffProfile } from '@/services/staffGate';

type Cleanup = () => void;

let currentCleanup: Cleanup | undefined;

let lastRoute = '#/';

function getPageTransitionTarget(root: Element | null): Element | null {
  if (!root) return null;
  const content = root.querySelector('.page-shell__content');
  return content ?? root;
}

function getHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/')) return hash;
  const path = window.location.pathname;
  if (path && path !== '/') return `#${path}`;
  return '#/';
}

function runWithPageTransition(render: () => Cleanup | void): void {
  const app = document.getElementById('app');
  if (!app) return;

  closeScanAndSubmit();
  currentCleanup?.();
  currentCleanup = undefined;

  const result = render();
  if (typeof result === 'function') {
    currentCleanup = result;
  }

  scrollToTop();

  requestAnimationFrame(() => {
    runPageEnter(getPageTransitionTarget(app.firstElementChild));
  });
}

function navigate(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const hash = getHash();

  if (hash.startsWith('#/submit')) {
    const returnTo = lastRoute;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${returnTo}`,
    );
    void openScanAndSubmit();
    if (!app.firstElementChild) {
      navigate();
    }
    return;
  }

  lastRoute = hash;
  resetPageMeta();

  if (hash === '#/' || hash === '#') {
    runWithPageTransition(() => renderHome(app));
    return;
  }

  const miiMatch = hash.match(/^#\/mii\/([^/]+)$/);
  if (miiMatch) {
    runWithPageTransition(() => renderDetail(app, miiMatch[1]!));
    return;
  }

  const remixMatch = hash.match(/^#\/create\/remix\/([^/]+)$/);
  if (remixMatch) {
    const remixId = remixMatch[1]!;
    void getAuthSession().then(async (session) => {
      if (getHash() !== `#/create/remix/${remixId}`) return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      const ready = await requireGamertag();
      if (getHash() !== `#/create/remix/${remixId}`) return;
      if (!ready) {
        window.location.hash = '#/';
        return;
      }

      const mii = await fetchMiiById(remixId);
      if (getHash() !== `#/create/remix/${remixId}`) return;
      if (!mii) {
        window.location.hash = '#/';
        return;
      }

      runWithPageTransition(() => renderCreate(app, { remixMii: mii }));
    });
    return;
  }

  if (hash === '#/create') {
    void getAuthSession().then(async (session) => {
      if (getHash() !== '#/create') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      const ready = await requireGamertag();
      if (getHash() !== '#/create') return;
      if (!ready) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => renderCreate(app));
    });
    return;
  }

  const editMatch = hash.match(/^#\/edit\/([^/]+)$/);
  if (editMatch) {
    const editId = editMatch[1]!;
    void getAuthSession().then(async (session) => {
      if (getHash() !== `#/edit/${editId}`) return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      const ready = await requireGamertag();
      if (getHash() !== `#/edit/${editId}`) return;
      if (!ready) {
        window.location.hash = '#/';
        return;
      }

      const mii = await fetchMiiById(editId);
      if (getHash() !== `#/edit/${editId}`) return;

      if (!mii) {
        window.location.hash = '#/';
        return;
      }

      if (!mii.user_id || mii.user_id !== session!.user.id) {
        window.location.hash = `#/mii/${mii.id}`;
        return;
      }

      runWithPageTransition(() => renderCreate(app, { editMii: mii }));
    });
    return;
  }

  if (hash === '#/profile') {
    void getAuthSession().then(async (session) => {
      if (getHash() !== '#/profile') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      const profile =
        (await fetchProfileById(session!.user.id)) ??
        (await ensureProfile(session!.user.id));
      if (hasCompletedProfile(profile)) {
        window.location.hash = `#/u/${encodeURIComponent(profile.username)}`;
      } else {
        window.location.hash = '#/settings';
      }
    });
    return;
  }

  const collectionMatch = hash.match(/^#\/collection\/([^/]+)$/);
  if (collectionMatch) {
    const collectionId = collectionMatch[1]!;
    runWithPageTransition(() => renderCollectionDetail(app, collectionId));
    return;
  }

  if (hash === '#/collections') {
    void getAuthSession().then((session) => {
      if (getHash() !== '#/collections') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => renderCollections(app));
    });
    return;
  }

  if (hash === '#/favorites') {
    void getAuthSession().then((session) => {
      if (getHash() !== '#/favorites') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => renderFavorites(app));
    });
    return;
  }

  if (hash === '#/uploads') {
    void getAuthSession().then((session) => {
      if (getHash() !== '#/uploads') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => renderUploads(app));
    });
    return;
  }

  if (hash === '#/settings' || hash.startsWith('#/settings#')) {
    void getAuthSession().then((session) => {
      if (!getHash().startsWith('#/settings')) return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => renderSettings(app));
    });
    return;
  }

  const userMatch = hash.match(/^#\/u\/([^/]+)$/);
  if (userMatch) {
    const username = decodeURIComponent(userMatch[1]!);
    if (!validateGamertag(username).ok) {
      window.location.hash = '#/';
      return;
    }
    runWithPageTransition(() =>
      renderProfile(app, {
        mode: 'public',
        username,
      }),
    );
    return;
  }

  if (hash === '#/browse') {
    runWithPageTransition(() => renderBrowse(app));
    return;
  }

  if (hash === '#/admin') {
    void requireStaffProfile().then((profile) => {
      if (getHash() !== '#/admin') return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminDashboard(app, profile);
      });
    });
    return;
  }

  if (hash === '#/admin/reports') {
    void requireStaffProfile().then((profile) => {
      if (getHash() !== '#/admin/reports') return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminReports(app, profile);
      });
    });
    return;
  }

  if (hash === '#/admin/auto-flags') {
    void requireStaffProfile().then((profile) => {
      if (getHash() !== '#/admin/auto-flags') return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminModerationQueue(app, profile);
      });
    });
    return;
  }

  const adminReportMatch = hash.match(/^#\/admin\/reports\/([^/]+)$/);
  if (adminReportMatch) {
    const reportId = adminReportMatch[1]!;
    void requireStaffProfile().then((profile) => {
      if (getHash() !== `#/admin/reports/${reportId}`) return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminReportDetail(app, profile, reportId);
      });
    });
    return;
  }

  if (hash === '#/admin/users') {
    void requireStaffProfile().then((profile) => {
      if (getHash() !== '#/admin/users') return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminUsers(app, profile);
      });
    });
    return;
  }

  if (hash === '#/admin/audit') {
    void requireStaffProfile().then((profile) => {
      if (getHash() !== '#/admin/audit') return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminAudit(app, profile);
      });
    });
    return;
  }

  if (hash === '#/admin/settings') {
    void requireAdminProfile().then((profile) => {
      if (getHash() !== '#/admin/settings') return;
      if (!profile) {
        window.location.hash = '#/';
        return;
      }
      runWithPageTransition(() => {
        void renderAdminSettings(app, profile);
      });
    });
    return;
  }

  const legalMatch = hash.match(/^#\/(legal|privacy|terms|child-safety|delete-account)$/);
  if (legalMatch && isLegalPageId(legalMatch[1]!)) {
    const pageId = legalMatch[1]!;
    runWithPageTransition(() => {
      renderLegal(app, pageId);
    });
    return;
  }

  window.location.hash = '#/';
}

function normalizeFragmentHash(): void {
  const hash = window.location.hash;
  if (hash === '#residents' || hash.startsWith('#residents')) {
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${base}#/`);
  }
}

export function initRouter(): void {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  initScanSubmitTriggers();
  normalizeFragmentHash();

  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  const onRoute = (): void => {
    normalizeFragmentHash();
    navigate();
  };
  window.addEventListener('hashchange', onRoute);
  window.addEventListener('popstate', onRoute);
  navigate();
}
