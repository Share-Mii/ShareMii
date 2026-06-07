import './pages.css';
import './Detail.css';
import '@/components/shared.css';
import '@/components/IconActionButton/IconActionButton.css';
import '@/components/IconActionCluster/IconActionCluster.css';
import {
  createDetailPageSkeleton,
} from '@/components/Skeleton/Skeleton';
import { wrapPublicPage } from '@/layout/pageShell';
import { createCommentSection } from '@/components/CommentSection/CommentSection';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  createDetailOverflowMenu,
  createDetailSocialPillBar,
} from '@/pages/detailSocialPillBar';
import '@/components/TileOverflowMenu/TileOverflowMenu.css';
import { createSocialPillBar } from '@/components/SocialPillBar/SocialPillBar';
import '@/components/SocialPillBar/SocialPillBar.css';
import {
  addUserFavorite,
  fetchMiiById,
  hasUserYeahedMii,
  incrementStat,
  isSupabaseConfigured,
  recordQrDownload,
  removeMiiStat,
  isUserFavorited,
  removeUserFavorite,
} from '@/services/supabase';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { createLiveMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { MII_STANDARD_VIEWS } from '@/services/miiViews';
import { openQRDisplayModal } from '@/components/QRDisplayModal/QRDisplayModal';
import {
  getTomodachiClothing,
  isTomodachiMii,
} from '@/services/tlClothing';
import { renderTomodachiClothingList } from '@/utils/tlClothingDisplay';
import { isYeahedLocally, setYeahedLocally } from '@/utils/yeahCache';
import { buildRenderUrl } from '@/services/miiApi';
import { MII_FACE_OG_SIZE } from '@/config/seo';
import { getSiteOrigin, setPageMeta } from '@/utils/pageMeta';
import { MOBILE_MQ } from '@/utils/viewport';
import { createRelatedMiisSection } from '@/components/RelatedMiis/RelatedMiis';
import { createRemixSection } from '@/components/RemixSection/RemixSection';
import { openAppealModal } from '@/components/AppealModal/AppealModal';
import { openAddToCollectionModal } from '@/components/AddToCollectionModal/AddToCollectionModal';
import type { Mii, MiiStat } from '@/types';
import { createCreatorAttribution } from '@/utils/creatorLink';
import { isStaff } from '@/utils/permissions';
import { ensureRateLimitAllowed } from '@/utils/rateLimit';
import { loadStaffProfile } from '@/services/staffGate';
import {
  hasRecordedQrDownload,
  markQrDownloadRecorded,
} from '@/utils/statSession';
import { icon, iconSpan, yeahIcon, yeahIconSpan } from '@/utils/icon';
const DETAIL_EXPRESSIONS = [
  { id: 'normal', label: 'Normal', icon: 'face-meh' },
  { id: 'happy', label: 'Happy', icon: 'face-smile' },
  { id: 'smile', label: 'Smile', icon: 'face-grin' },
  { id: 'wink_left', label: 'Wink', icon: 'face-grin-wink' },
] as const;

function expressionForApi(id: string): string | undefined {
  return id === 'normal' ? undefined : id;
}

export function renderDetail(
  container: HTMLElement,
  id: string,
): () => void {
  let abort = false;
  let cleanupDetail: (() => void) | null = null;
  let cleanupMobileLayout: (() => void) | null = null;

  container.replaceChildren(wrapPublicPage(createDetailPageSkeleton()));

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      container.innerHTML =
        '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    const mii = await fetchMiiById(id);
    if (abort) return;

    if (!mii) {
      container.replaceChildren(
        wrapPublicPage(
          Object.assign(document.createElement('main'), {
            className: 'page-content page-content--offset-top',
            innerHTML:
              '<p class="page-error">This content is unavailable. <a href="/">Go home</a></p>',
          }),
        ),
      );
      return;
    }

    if (mii.visibility !== 'public') {
      const staffProfile = await loadStaffProfile();
      if (!isStaff(staffProfile)) {
        container.replaceChildren(
          wrapPublicPage(
            Object.assign(document.createElement('main'), {
              className: 'page-content page-content--offset-top',
              innerHTML:
                '<p class="page-error">This Mii is unavailable. <a href="/">Go home</a></p>',
            }),
          ),
        );
        return;
      }
    }

    const page = document.createElement('main');
    page.className = 'detail-page';

    const back = document.createElement('a');
    back.href = '/';
    back.className = 'detail-back interactive';

    const MOBILE_DETAIL_MQ = MOBILE_MQ;

    function syncDetailMobileLayout(): void {
      const mobile = window.matchMedia(MOBILE_DETAIL_MQ).matches;
      page.classList.toggle('detail-page--app', mobile);
      back.innerHTML = mobile
        ? `${icon('arrow-left')} Back`
        : `${icon('arrow-left')} Back to plaza`;
    }

    const mobileDetailMq = window.matchMedia(MOBILE_DETAIL_MQ);
    mobileDetailMq.addEventListener('change', syncDetailMobileLayout);
    cleanupMobileLayout = () => {
      mobileDetailMq.removeEventListener('change', syncDetailMobileLayout);
    };

    const session = await getAuthSession();
    const isOwner =
      isLoggedIn(session) &&
      Boolean(mii.user_id) &&
      mii.user_id === session!.user.id;

    const built = buildDetailContent(mii, isOwner);
    cleanupDetail = built.cleanup;
    const detail = built.el;

    syncDetailMobileLayout();

    const viewedKey = `viewed:${id}`;
    if (!sessionStorage.getItem(viewedKey)) {
      void incrementStat(id, 'views')
        .then((result) => {
          if (!result.recorded) return;
          built.setStatCount('views', mii.views + 1);
          sessionStorage.setItem(viewedKey, '1');
        })
        .catch(() => {});
    }

    const discuss = await createCommentSection(mii.id);
    if (abort) return;

    const remix = await createRemixSection(mii);
    if (abort) return;

    const related = await createRelatedMiisSection(mii);
    if (abort) return;

    setPageMeta({
      title: `${mii.name} Mii QR Code`,
      description:
        mii.description ||
        `${mii.name} — shared on ShareMii by ${mii.creator_name || 'the community'}`,
      image: buildRenderUrl(mii.mii_data, { type: 'face', width: MII_FACE_OG_SIZE }),
      imageWidth: MII_FACE_OG_SIZE,
      imageHeight: MII_FACE_OG_SIZE,
      url: `${getSiteOrigin()}/mii/${mii.id}`,
    });

    page.append(back, detail);

    if (isOwner && mii.visibility !== 'public') {
      const appealBar = document.createElement('div');
      appealBar.className = 'detail-appeal-bar';
      const appealBtn = document.createElement('button');
      appealBtn.type = 'button';
      appealBtn.className = 'pill-btn pill-btn--outline interactive';
      appealBtn.textContent = 'Appeal moderation';
      appealBtn.addEventListener('click', () => {
        openAppealModal({
          targetType: 'mii',
          targetId: mii.id,
          targetLabel: mii.name,
        });
      });
      appealBar.appendChild(appealBtn);
      page.appendChild(appealBar);
    }

    if (remix) page.appendChild(remix);
    if (related) page.appendChild(related);
    page.appendChild(discuss);
    container.replaceChildren(wrapPublicPage(page));
  }

  load();

  return () => {
    abort = true;
    cleanupDetail?.();
    cleanupDetail = null;
    cleanupMobileLayout?.();
    cleanupMobileLayout = null;
  };
}

function buildDetailContent(
  mii: Mii,
  isOwner: boolean,
): {
  el: HTMLElement;
  cleanup: () => void;
  setStatCount: (stat: MiiStat, value: number) => void;
} {
  const wrap = document.createElement('div');
  wrap.className = 'detail';

  const left = document.createElement('div');
  const mainRender = document.createElement('div');
  mainRender.className = 'detail__render-main';

  const renderChrome = document.createElement('div');
  renderChrome.className = 'detail__render-chrome';

  const renderSlot = document.createElement('div');
  renderSlot.className = 'detail__render-slot';

  const heroLive = createLiveMiiRenderer({
    miiData: mii.mii_data,
    width: 512,
    alt: mii.name,
    view: MII_STANDARD_VIEWS[0],
  });
  renderSlot.appendChild(heroLive.root);

  let activeExpression = 'normal';

  const exprPill = createSocialPillBar({
    className: 'detail__expr-pill',
    orientation: 'vertical',
    toggleLabel: 'Expressions',
    toggleIcon: 'face-smile',
    bubblePlacement: 'left',
    items: DETAIL_EXPRESSIONS.map((expr) => ({
      iconName: expr.icon,
      label: expr.label,
      active: expr.id === activeExpression,
      onClick: (e) => {
        e.stopPropagation();
        activeExpression = expr.id;
        heroLive.setExpression(expressionForApi(expr.id));
        const toggle = exprPill.querySelector<HTMLButtonElement>(
          '.social-pill-bar__toggle',
        );
        if (toggle) {
          toggle.dataset.closedIcon = expr.icon;
          if (!exprPill.classList.contains('social-pill-bar--open')) {
            toggle.innerHTML = icon(expr.icon);
          }
        }
        for (const btn of exprPill.querySelectorAll<HTMLButtonElement>(
          '.social-pill-bar__expand .icon-action',
        )) {
          const on = btn.getAttribute('aria-label') === expr.label;
          btn.classList.toggle('icon-action--active', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      },
    })),
  });

  renderChrome.append(renderSlot, exprPill);

  const renderControls = document.createElement('div');
  renderControls.className = 'detail__render-controls';

  const viewGroup = document.createElement('div');
  viewGroup.className = 'detail__control-group';

  const viewLabel = document.createElement('span');
  viewLabel.className = 'detail__control-label';
  viewLabel.textContent = 'Angle';

  const viewRow = document.createElement('div');
  viewRow.className = 'detail__views';
  viewRow.setAttribute('aria-label', 'View angle');
  let activeViewId = MII_STANDARD_VIEWS[0]!.id;

  for (const view of MII_STANDARD_VIEWS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail__view-btn interactive';
    btn.textContent = view.label;
    btn.dataset.viewId = view.id;
    btn.setAttribute('aria-pressed', view.id === activeViewId ? 'true' : 'false');
    if (view.id === activeViewId) btn.classList.add('detail__view-btn--active');
    btn.addEventListener('click', () => {
      if (activeViewId === view.id) return;
      activeViewId = view.id;
      heroLive.setView(view);
      for (const b of viewRow.querySelectorAll<HTMLButtonElement>('.detail__view-btn')) {
        const on = b.dataset.viewId === view.id;
        b.classList.toggle('detail__view-btn--active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    });
    viewRow.appendChild(btn);
  }

  viewGroup.append(viewLabel, viewRow);
  renderControls.appendChild(viewGroup);

  mainRender.append(renderChrome, renderControls);
  left.appendChild(mainRender);

  const right = document.createElement('div');
  right.className = 'detail__info';

  const head = document.createElement('div');
  head.className = 'detail__head';

  const headRow = document.createElement('div');
  headRow.className = 'detail__head-row';

  const name = document.createElement('h2');
  name.className = 'detail__name';
  name.textContent = mii.name;
  headRow.appendChild(name);

  const headActions = document.createElement('div');
  headActions.className = 'detail__head-actions';

  const detailCallbacks = {
    onMiiUpdated: (updated: Mii) => {
      name.textContent = updated.name;
      badge.textContent = updated.platform;
      desc.textContent = updated.description || 'No description.';
    },
  };

  headActions.appendChild(createDetailSocialPillBar(mii, isOwner, detailCallbacks));

  headRow.appendChild(headActions);
  head.appendChild(headRow);

  if (mii.visibility !== 'public') {
    const staffNote = document.createElement('p');
    staffNote.className = 'admin-staff-banner';
    staffNote.textContent = 'STAFF VIEW — hidden content';
    head.appendChild(staffNote);
  }

  const badge = document.createElement('span');
  badge.className = 'detail__badge';
  badge.textContent = mii.platform;

  const desc = document.createElement('p');
  desc.className = 'detail__desc';
  desc.textContent = mii.description || 'No description.';

  const creator = createCreatorAttribution(mii, 'detail__creator');

  const clothingEl = document.createElement('div');
  clothingEl.hidden = true;

  if (isTomodachiMii(mii)) {
    clothingEl.className = 'detail__clothing';
    clothingEl.hidden = false;
    clothingEl.innerHTML =
      '<p class="detail__clothing-label">Tomodachi Life outfit</p><p class="detail__clothing-loading skeleton skeleton--pill" aria-busy="true">Loading…</p>';

    getTomodachiClothing(mii.mii_data_download!)
      .then(({ items }) => {
        if (!items.length) {
          clothingEl.hidden = true;
          return;
        }
        clothingEl.innerHTML = `<p class="detail__clothing-label">Tomodachi Life outfit</p>${renderTomodachiClothingList(items)}`;
      })
      .catch(() => {
        clothingEl.hidden = true;
      });
  }

  const stats = document.createElement('div');
  stats.className = 'detail__stats';
  stats.innerHTML = `
    <span class="detail__stat" data-stat="favorites">${yeahIcon()} <span class="detail__stat-value">${mii.favorites}</span> yeahs</span>
    <span class="detail__stat" data-stat="downloads">${icon('download')} <span class="detail__stat-value">${mii.downloads}</span> downloads</span>
    <span class="detail__stat" data-stat="views">${icon('eye')} <span class="detail__stat-value">${mii.views}</span> views</span>
  `;

  function setStatCount(stat: MiiStat, value: number): void {
    const countEl = stats.querySelector(
      `[data-stat="${stat}"] .detail__stat-value`,
    );
    if (countEl) countEl.textContent = String(value);
    if (stat === 'favorites') mii.favorites = value;
    else if (stat === 'downloads') mii.downloads = value;
    else mii.views = value;
  }

  const heartBtn = document.createElement('button');
  heartBtn.type = 'button';
  heartBtn.className = 'pill-btn interactive';
  heartBtn.innerHTML = `${yeahIconSpan()} Yeah`;

  function setYeahActive(active: boolean): void {
    heartBtn.classList.toggle('detail__heart--active', active);
    setYeahedLocally(mii.id, active);
  }

  void (async () => {
    const session = await getAuthSession();
    if (!isLoggedIn(session)) {
      if (isYeahedLocally(mii.id)) setYeahActive(true);
      return;
    }
    try {
      const serverYeah = await hasUserYeahedMii(mii.id);
      setYeahActive(serverYeah);
      if (!serverYeah && isYeahedLocally(mii.id)) {
        setYeahedLocally(mii.id, false);
      }
    } catch {
      if (isYeahedLocally(mii.id)) setYeahActive(true);
    }
  })();

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pill-btn pill-btn--outline interactive detail__save';
  saveBtn.innerHTML = `${iconSpan('star')} Save`;

  void (async () => {
    if (!isLoggedIn(await getAuthSession())) return;
    try {
      if (await isUserFavorited(mii.id)) {
        saveBtn.classList.add('detail__save--active');
        saveBtn.innerHTML = `${iconSpan('star')} Saved`;
      }
    } catch {
      /* ignore */
    }
  })();

  const collectionBtn = document.createElement('button');
  collectionBtn.type = 'button';
  collectionBtn.className =
    'pill-btn pill-btn--outline interactive detail__action-overflow detail__action-secondary';
  collectionBtn.innerHTML = `${iconSpan('folder-plus')} Add to collection`;
  const openCollection = async (): Promise<void> => {
    if (!isLoggedIn(await getAuthSession())) {
      openLoginModal();
      return;
    }
    openAddToCollectionModal({ miiId: mii.id });
  };
  collectionBtn.addEventListener('click', () => {
    void openCollection();
  });

  saveBtn.addEventListener('click', async () => {
    if (!isLoggedIn(await getAuthSession())) {
      openLoginModal();
      return;
    }

    const active = saveBtn.classList.contains('detail__save--active');
    try {
      if (active) {
        await removeUserFavorite(mii.id);
        saveBtn.classList.remove('detail__save--active');
        saveBtn.innerHTML = `${iconSpan('star')} Save`;
      } else {
        await addUserFavorite(mii.id);
        saveBtn.classList.add('detail__save--active');
        saveBtn.innerHTML = `${iconSpan('star')} Saved`;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update favorite');
    }
  });

  heartBtn.addEventListener('click', async () => {
    const session = await getAuthSession();

    if (heartBtn.classList.contains('detail__heart--active')) {
      if (!isLoggedIn(session)) {
        openLoginModal();
        return;
      }

      const previousCount = mii.favorites;
      setYeahActive(false);
      setStatCount('favorites', Math.max(0, previousCount - 1));

      try {
        const result = await removeMiiStat(mii.id, 'favorites');
        if (!result.recorded) {
          if (result.reason !== 'not_found') {
            setYeahActive(true);
            setStatCount('favorites', previousCount);
          }
        }
      } catch (err) {
        setYeahActive(true);
        setStatCount('favorites', previousCount);
        alert(
          err instanceof Error ? err.message : 'Could not unyeah. Try again.',
        );
      }
      return;
    }

    if (!isLoggedIn(session)) {
      openLoginModal();
      return;
    }

    const previousCount = mii.favorites;
    setYeahActive(true);
    setStatCount('favorites', previousCount + 1);

    try {
      await ensureRateLimitAllowed('yeah');
      const result = await incrementStat(mii.id, 'favorites');
      if (!result.recorded) {
        setYeahActive(false);
        setStatCount('favorites', previousCount);
      }
    } catch (err) {
      setYeahActive(false);
      setStatCount('favorites', previousCount);
      alert(
        err instanceof Error ? err.message : 'Could not yeah. Try again.',
      );
    }
  });

  const qrBtn = document.createElement('button');
  qrBtn.type = 'button';
  qrBtn.className =
    'pill-btn pill-btn--filled interactive detail__action-overflow detail__action-qr';
  qrBtn.innerHTML = `${iconSpan('qrcode')} QR`;

  const showQr = (): void => {
    if (!hasRecordedQrDownload(mii.id)) {
      markQrDownloadRecorded(mii.id);
      void recordQrDownload(mii.id).then((result) => {
        if (result.recorded) {
          document.dispatchEvent(
            new CustomEvent('sharemii:stat-updated', {
              detail: { miiId: mii.id, stat: 'downloads' as const },
            }),
          );
        }
      });
    }
    openQRDisplayModal(mii);
  };

  qrBtn.addEventListener('click', showQr);

  headActions.appendChild(
    createDetailOverflowMenu(mii, isOwner, detailCallbacks, [
      {
        label: 'Add to collection',
        onSelect: () => {
          void openCollection();
        },
      },
      { label: 'Show QR code', onSelect: showQr },
    ]),
  );

  const onStatUpdated = (e: Event): void => {
    const detail = (e as CustomEvent<{ miiId: string; stat: MiiStat }>).detail;
    if (detail.miiId !== mii.id || detail.stat !== 'downloads') return;
    setStatCount('downloads', mii.downloads + 1);
  };
  document.addEventListener('sharemii:stat-updated', onStatUpdated);

  const actionsPrimary = document.createElement('div');
  actionsPrimary.className = 'detail__actions-primary';
  actionsPrimary.append(heartBtn, saveBtn, collectionBtn, qrBtn);

  const footerActions = document.createElement('div');
  footerActions.className = 'detail__footer-actions';
  footerActions.append(actionsPrimary);

  right.append(head, creator, badge, desc, clothingEl, stats, footerActions);

  wrap.append(left, right);
  return {
    el: wrap,
    setStatCount,
    cleanup: () => {
      document.removeEventListener('sharemii:stat-updated', onStatUpdated);
    },
  };
}
