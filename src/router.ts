import { renderHome } from '@/pages/Home';
import { renderDetail } from '@/pages/Detail';
import { renderBrowse } from '@/pages/Browse';
import { fetchMiiById } from '@/services/supabase';
import { renderProfile } from '@/pages/Profile';
import { renderFavorites } from '@/pages/Favorites';
import { renderFeed } from '@/pages/Feed';
import { renderCollections } from '@/pages/Collections';
import { renderCollectionDetail } from '@/pages/CollectionDetail';
import { renderUploads } from '@/pages/Uploads';
import { renderSettings } from '@/pages/Settings';
import {
  ensureProfile,
  fetchProfileById,
  hasCompletedProfile,
} from '@/services/profile';
import { renderAbout } from '@/pages/About';
import { renderHelp } from '@/pages/Help';
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
import { renderAdminBugReports } from '@/pages/admin/BugReports';
import { renderAdminBugReportDetail } from '@/pages/admin/BugReportDetail';
import { renderAdminAppeals } from '@/pages/admin/Appeals';
import { renderTagBrowse } from '@/pages/TagBrowse';
import { renderCollectionsDiscover } from '@/pages/CollectionsDiscover';
import { renderCreatorDashboard } from '@/pages/CreatorDashboard';
import { requireAdminProfile, requireStaffProfile } from '@/services/staffGate';
import {
  getRoutePath,
  navigateTo,
  normalizeRoutePath,
  ROUTE_CHANGE_EVENT,
} from '@/utils/navigation';

type Cleanup = () => void;

let currentCleanup: Cleanup | undefined;

let lastRoute = '/';

function getPageTransitionTarget(root: Element | null): Element | null {
  if (!root) return null;
  const content = root.querySelector('.page-shell__content');
  return content ?? root;
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

  const path = getRoutePath();

  if (path === '/submit' || path.startsWith('/submit/')) {
    const returnTo = lastRoute;
    navigateTo(returnTo, true);
    void openScanAndSubmit();
    if (!app.firstElementChild) {
      navigate();
    }
    return;
  }

  lastRoute = path;
  resetPageMeta();

  if (path === '/') {
    runWithPageTransition(() => renderHome(app));
    return;
  }

  const miiMatch = path.match(/^\/mii\/([^/]+)$/);
  if (miiMatch) {
    runWithPageTransition(() => renderDetail(app, miiMatch[1]!));
    return;
  }

  const remixMatch = path.match(/^\/create\/remix\/([^/]+)$/);
  if (remixMatch) {
    const remixId = remixMatch[1]!;
    void getAuthSession().then(async (session) => {
      if (getRoutePath() !== `/create/remix/${remixId}`) return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      const ready = await requireGamertag();
      if (getRoutePath() !== `/create/remix/${remixId}`) return;
      if (!ready) {
        navigateTo('/');
        return;
      }

      const mii = await fetchMiiById(remixId);
      if (getRoutePath() !== `/create/remix/${remixId}`) return;
      if (!mii) {
        navigateTo('/');
        return;
      }

      const { renderCreate } = await import('@/pages/Create');
      runWithPageTransition(() => renderCreate(app, { remixMii: mii }));
    });
    return;
  }

  if (path === '/create') {
    const importDraft =
      new URLSearchParams(window.location.search).get('import') === 'draft';
    if (importDraft) {
      void import('@/pages/CreateImport').then(({ renderCreateImport }) => {
        if (getRoutePath() !== '/create') return;
        runWithPageTransition(() => renderCreateImport(app));
      });
      return;
    }

    void getAuthSession().then(async (session) => {
      if (getRoutePath() !== '/create') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      const ready = await requireGamertag();
      if (getRoutePath() !== '/create') return;
      if (!ready) {
        navigateTo('/');
        return;
      }
      const { renderCreate } = await import('@/pages/Create');
      runWithPageTransition(() => renderCreate(app));
    });
    return;
  }

  if (path === '/embed/maker') {
    void import('@/pages/Create').then(({ renderCreate }) => {
      if (getRoutePath() !== '/embed/maker') return;
      runWithPageTransition(() => renderCreate(app, { embed: true }));
    });
    return;
  }

  const editMatch = path.match(/^\/edit\/([^/]+)$/);
  if (editMatch) {
    const editId = editMatch[1]!;
    void getAuthSession().then(async (session) => {
      if (getRoutePath() !== `/edit/${editId}`) return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      const ready = await requireGamertag();
      if (getRoutePath() !== `/edit/${editId}`) return;
      if (!ready) {
        navigateTo('/');
        return;
      }

      const mii = await fetchMiiById(editId);
      if (getRoutePath() !== `/edit/${editId}`) return;

      if (!mii) {
        navigateTo('/');
        return;
      }

      if (!mii.user_id || mii.user_id !== session!.user.id) {
        navigateTo(`/mii/${mii.id}`);
        return;
      }

      const { renderCreate } = await import('@/pages/Create');
      runWithPageTransition(() => renderCreate(app, { editMii: mii }));
    });
    return;
  }

  if (path === '/profile') {
    void getAuthSession().then(async (session) => {
      if (getRoutePath() !== '/profile') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      const profile =
        (await fetchProfileById(session!.user.id)) ??
        (await ensureProfile(session!.user.id));
      if (hasCompletedProfile(profile)) {
        navigateTo(`/u/${encodeURIComponent(profile.username)}`);
      } else {
        navigateTo('/settings');
      }
    });
    return;
  }

  const collectionMatch = path.match(/^\/collection\/([^/]+)$/);
  if (collectionMatch) {
    const collectionId = collectionMatch[1]!;
    runWithPageTransition(() => renderCollectionDetail(app, collectionId));
    return;
  }

  if (path === '/collections') {
    void getAuthSession().then((session) => {
      if (getRoutePath() !== '/collections') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => renderCollections(app));
    });
    return;
  }

  if (path === '/feed') {
    void getAuthSession().then((session) => {
      if (getRoutePath() !== '/feed') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => renderFeed(app));
    });
    return;
  }

  if (path === '/favorites') {
    void getAuthSession().then((session) => {
      if (getRoutePath() !== '/favorites') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => renderFavorites(app));
    });
    return;
  }

  if (path === '/uploads') {
    void getAuthSession().then((session) => {
      if (getRoutePath() !== '/uploads') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => renderUploads(app));
    });
    return;
  }

  if (path === '/settings' || path.startsWith('/settings/')) {
    void getAuthSession().then((session) => {
      if (!getRoutePath().startsWith('/settings')) return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => renderSettings(app));
    });
    return;
  }

  const userMatch = path.match(/^\/u\/([^/]+)$/);
  if (userMatch) {
    const username = decodeURIComponent(userMatch[1]!);
    if (!validateGamertag(username).ok) {
      navigateTo('/');
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

  if (path === '/about') {
    runWithPageTransition(() => {
      renderAbout(app);
    });
    return;
  }

  if (path === '/help') {
    runWithPageTransition(() => {
      renderHelp(app);
    });
    return;
  }

  if (path === '/browse') {
    runWithPageTransition(() => renderBrowse(app));
    return;
  }

  if (path === '/tags') {
    void import('@/pages/TagsIndex').then(({ renderTagsIndex }) => {
      if (getRoutePath() !== '/tags') return;
      runWithPageTransition(() => renderTagsIndex(app));
    });
    return;
  }

  const tagMatch = path.match(/^\/tag\/([^/]+)$/);
  if (tagMatch) {
    const slug = decodeURIComponent(tagMatch[1]!);
    runWithPageTransition(() => renderTagBrowse(app, slug));
    return;
  }

  if (path === '/collections/browse') {
    runWithPageTransition(() => renderCollectionsDiscover(app));
    return;
  }

  if (path === '/dashboard') {
    void getAuthSession().then((session) => {
      if (getRoutePath() !== '/dashboard') return;
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => renderCreatorDashboard(app));
    });
    return;
  }

  if (path === '/admin') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminDashboard(app, profile);
      });
    });
    return;
  }

  if (path === '/admin/bugs') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin/bugs') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminBugReports(app, profile);
      });
    });
    return;
  }

  const adminBugMatch = path.match(/^\/admin\/bugs\/([^/]+)$/);
  if (adminBugMatch) {
    const bugId = adminBugMatch[1]!;
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== `/admin/bugs/${bugId}`) return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminBugReportDetail(app, profile, bugId);
      });
    });
    return;
  }

  if (path === '/admin/appeals') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin/appeals') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminAppeals(app, profile);
      });
    });
    return;
  }

  if (path === '/admin/reports') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin/reports') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminReports(app, profile);
      });
    });
    return;
  }

  if (path === '/admin/auto-flags') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin/auto-flags') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminModerationQueue(app, profile);
      });
    });
    return;
  }

  const adminReportMatch = path.match(/^\/admin\/reports\/([^/]+)$/);
  if (adminReportMatch) {
    const reportId = adminReportMatch[1]!;
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== `/admin/reports/${reportId}`) return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminReportDetail(app, profile, reportId);
      });
    });
    return;
  }

  if (path === '/admin/users') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin/users') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminUsers(app, profile);
      });
    });
    return;
  }

  if (path === '/admin/audit') {
    void requireStaffProfile().then((profile) => {
      if (getRoutePath() !== '/admin/audit') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminAudit(app, profile);
      });
    });
    return;
  }

  if (path === '/admin/settings') {
    void requireAdminProfile().then((profile) => {
      if (getRoutePath() !== '/admin/settings') return;
      if (!profile) {
        navigateTo('/');
        return;
      }
      runWithPageTransition(() => {
        void renderAdminSettings(app, profile);
      });
    });
    return;
  }

  const legalMatch = path.match(/^\/(legal|privacy|terms|child-safety|delete-account)$/);
  if (legalMatch && isLegalPageId(legalMatch[1]!)) {
    const pageId = legalMatch[1]!;
    runWithPageTransition(() => {
      renderLegal(app, pageId);
    });
    return;
  }

  navigateTo('/');
}

function normalizeLegacyHash(): void {
  const hash = window.location.hash;
  if (hash === '#residents' || hash.startsWith('#residents')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    window.location.hash = '';
  }
}

function bindSpaLinkClicks(): void {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const anchor = (e.target as Element).closest('a');
    if (!anchor) return;
    if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/')) return;

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    e.preventDefault();
    const next = normalizeRoutePath(url.pathname);
    const current = getRoutePath();
    if (next !== current) {
      navigateTo(next);
    } else {
      navigate();
    }
  });
}

export function initRouter(): void {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  initScanSubmitTriggers();
  normalizeLegacyHash();
  bindSpaLinkClicks();

  const onRoute = (): void => {
    normalizeLegacyHash();
    navigate();
  };
  window.addEventListener(ROUTE_CHANGE_EVENT, onRoute);
  window.addEventListener('popstate', onRoute);
  navigate();
}
