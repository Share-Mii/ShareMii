import { fetchDashboardStats } from '@/services/admin';
import type { AdminDashboardStats, Profile } from '@/types';
import { wrapAdminPage } from '@/pages/admin/adminShell';
import { escapeHtml } from '@/utils/escapeHtml';
import { icon, iconSpan } from '@/utils/icon';

interface StatCardConfig {
  key: keyof AdminDashboardStats;
  label: string;
  icon: string;
  tone?: 'default' | 'accent' | 'warn' | 'danger';
  featured?: boolean;
}

const QUEUE_STATS: StatCardConfig[] = [
  {
    key: 'open_reports',
    label: 'Open reports',
    icon: 'inbox',
    tone: 'accent',
    featured: true,
  },
  {
    key: 'urgent_reports',
    label: 'Urgent',
    icon: 'triangle-exclamation',
    tone: 'danger',
  },
  {
    key: 'reports_over_24h',
    label: 'Past 24h SLA',
    icon: 'clock',
    tone: 'warn',
  },
  {
    key: 'reports_over_72h',
    label: 'Past 72h SLA',
    icon: 'hourglass-half',
    tone: 'danger',
  },
];

const ACTIVITY_STATS: StatCardConfig[] = [
  { key: 'miis_today', label: 'Miis uploaded', icon: 'user' },
  { key: 'comments_today', label: 'Comments', icon: 'comment' },
  { key: 'signups_today', label: 'New residents', icon: 'user-plus' },
  {
    key: 'staff_actions_7d',
    label: 'Staff actions (7d)',
    icon: 'shield-halved',
  },
];

function healthState(stats: AdminDashboardStats): 'ok' | 'watch' | 'critical' {
  if (stats.urgent_reports > 0 || stats.reports_over_72h > 0) return 'critical';
  if (stats.reports_over_24h > 0 || stats.open_reports > 5) return 'watch';
  return 'ok';
}

function healthCopy(
  stats: AdminDashboardStats,
  state: ReturnType<typeof healthState>,
): { title: string; detail: string; icon: string } {
  if (state === 'critical') {
    return {
      title: 'Needs attention',
      detail: `${stats.urgent_reports} urgent and ${stats.reports_over_72h} report(s) beyond 72h SLA.`,
      icon: 'circle-exclamation',
    };
  }
  if (state === 'watch') {
    return {
      title: 'Queue building',
      detail: `${stats.open_reports} open report(s); ${stats.reports_over_24h} waiting over 24 hours.`,
      icon: 'bell',
    };
  }
  return {
    title: 'All clear',
    detail: 'No urgent items in the moderation queue right now.',
    icon: 'circle-check',
  };
}

function createStatCard(value: number, config: StatCardConfig): HTMLElement {
  const card = document.createElement('article');
  card.className = [
    'admin-stat',
    config.featured ? 'admin-stat--featured' : '',
    config.tone ? `admin-stat--${config.tone}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'admin-stat__icon';
  iconWrap.innerHTML = icon(config.icon);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'admin-stat__body';

  const val = document.createElement('span');
  val.className = 'admin-stat__value';
  val.textContent = String(value);

  const lab = document.createElement('span');
  lab.className = 'admin-stat__label';
  lab.textContent = config.label;

  bodyEl.append(val, lab);
  card.append(iconWrap, bodyEl);
  return card;
}

function createStatGrid(
  stats: AdminDashboardStats,
  configs: StatCardConfig[],
): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'admin-stat-grid';
  for (const cfg of configs) {
    const val = stats[cfg.key];
    if (typeof val === 'number') {
      grid.appendChild(createStatCard(val, cfg));
    }
  }
  return grid;
}

function createSection(
  title: string,
  lead: string,
  body: HTMLElement,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'admin-section';
  const head = document.createElement('div');
  head.className = 'admin-section__head';
  const h2 = document.createElement('h2');
  h2.className = 'admin-section__title';
  h2.textContent = title;
  const p = document.createElement('p');
  p.className = 'admin-section__lead';
  p.textContent = lead;
  head.append(h2, p);
  section.append(head, body);
  return section;
}

function renderDashboardSkeleton(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'admin-dashboard';
  root.setAttribute('aria-busy', 'true');

  const health = document.createElement('div');
  health.className = 'admin-health skeleton';
  health.style.minHeight = '5rem';

  const grid = document.createElement('div');
  grid.className = 'admin-stat-grid';
  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div');
    card.className = 'admin-stat skeleton';
    card.style.minHeight = '5.5rem';
    grid.appendChild(card);
  }

  root.append(health, grid);
  return root;
}

function renderDashboard(stats: AdminDashboardStats): HTMLElement {
  const root = document.createElement('div');
  root.className = 'admin-dashboard';

  const state = healthState(stats);
  const health = healthCopy(stats, state);

  const healthEl = document.createElement('div');
  healthEl.className = `admin-health admin-health--${state}`;

  const healthIcon = document.createElement('span');
  healthIcon.className = 'admin-health__icon';
  healthIcon.innerHTML = icon(health.icon);

  const healthCopyEl = document.createElement('div');
  healthCopyEl.className = 'admin-health__copy';
  const healthTitle = document.createElement('strong');
  healthTitle.className = 'admin-health__title';
  healthTitle.textContent = health.title;
  const healthDetail = document.createElement('p');
  healthDetail.className = 'admin-health__detail';
  healthDetail.textContent = health.detail;
  healthCopyEl.append(healthTitle, healthDetail);
  healthEl.append(healthIcon, healthCopyEl);

  const riskList = document.createElement('ul');
  riskList.className = 'admin-risk-list';

  const riskItems: { icon: string; text: string; tone: string }[] = [];
  if (stats.reports_over_24h > 0) {
    riskItems.push({
      icon: 'clock',
      text: `${stats.reports_over_24h} report(s) exceeded the 24-hour SLA`,
      tone: 'warn',
    });
  }
  if (stats.urgent_reports > 0) {
    riskItems.push({
      icon: 'triangle-exclamation',
      text: `${stats.urgent_reports} urgent priority report(s)`,
      tone: 'danger',
    });
  }
  if (
    stats.open_reports === 0 &&
    stats.reports_over_24h === 0 &&
    stats.urgent_reports === 0
  ) {
    riskItems.push({
      icon: 'circle-check',
      text: 'Queue is empty — nice work!',
      tone: 'ok',
    });
  }

  if (!riskItems.length) {
    const li = document.createElement('li');
    li.className = 'admin-risk-list__item admin-risk-list__item--ok';
    li.innerHTML = `${iconSpan('circle-check')} No active risk signals`;
    riskList.appendChild(li);
  } else {
    for (const r of riskItems) {
      const li = document.createElement('li');
      li.className = `admin-risk-list__item admin-risk-list__item--${r.tone}`;
      li.innerHTML = `${iconSpan(r.icon)} ${escapeHtml(r.text)}`;
      riskList.appendChild(li);
    }
  }

  root.append(
    healthEl,
    createSection(
      'Queue health',
      'Moderation backlog and SLA pressure.',
      createStatGrid(stats, QUEUE_STATS),
    ),
    createSection(
      "Today's activity",
      'What happened on ShareMii in the last 24 hours.',
      createStatGrid(stats, ACTIVITY_STATS),
    ),
    createSection(
      'Risk signals',
      'Automated highlights from the report queue.',
      riskList,
    ),
  );

  return root;
}

export async function renderAdminDashboard(
  container: HTMLElement,
  profile: Profile,
): Promise<void> {
  const content = document.createElement('div');
  content.appendChild(renderDashboardSkeleton());

  container.replaceChildren(
    wrapAdminPage(profile, 'Dashboard', content, {
      subtitle: 'Queue health and site activity at a glance.',
    }),
  );

  try {
    const stats = await fetchDashboardStats();
    content.replaceChildren(renderDashboard(stats));
  } catch (err) {
    content.replaceChildren();
    const errEl = document.createElement('p');
    errEl.className = 'page-error';
    errEl.textContent =
      err instanceof Error ? err.message : 'Failed to load dashboard.';
    content.appendChild(errEl);
  }
}
