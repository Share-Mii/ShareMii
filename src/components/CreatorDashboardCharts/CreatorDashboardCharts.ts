import './CreatorDashboardCharts.css';
import {
  Chart,
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import type { MiiCollection } from '@/services/social';
import type { CreatorStats } from '@/types';

Chart.register(
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

let chartInstances: Chart[] = [];

function getThemeColors(): {
  accent: string;
  textMuted: string;
  text: string;
  border: string;
} {
  const root = getComputedStyle(document.documentElement);
  return {
    accent: root.getPropertyValue('--color-accent').trim() || '#0088ff',
    textMuted: root.getPropertyValue('--color-text-muted').trim() || '#6b7280',
    text: root.getPropertyValue('--color-text').trim() || '#1a1a1a',
    border: root.getPropertyValue('--color-border').trim() || '#e5e7eb',
  };
}

function createChartPanel(title: string): {
  panel: HTMLElement;
  canvas: HTMLCanvasElement;
} {
  const panel = document.createElement('div');
  panel.className = 'creator-dashboard-charts__panel';

  const heading = document.createElement('h2');
  heading.className = 'creator-dashboard-charts__title';
  heading.textContent = title;

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'creator-dashboard-charts__canvas-wrap';

  const canvas = document.createElement('canvas');
  canvasWrap.appendChild(canvas);
  panel.append(heading, canvasWrap);

  return { panel, canvas };
}

export function renderCreatorDashboardCharts(
  stats: CreatorStats,
  collections: MiiCollection[],
  container: HTMLElement,
): void {
  destroyCreatorDashboardCharts();
  container.replaceChildren();

  const colors = getThemeColors();

  const engagement = createChartPanel('Engagement');
  const uploads = createChartPanel('Upload visibility');
  const collectionsPanel = createChartPanel('Items per collection');
  collectionsPanel.panel.classList.add('creator-dashboard-charts__panel--wide');

  container.append(engagement.panel, uploads.panel, collectionsPanel.panel);

  const engagementChart = new Chart(engagement.canvas, {
    type: 'bar',
    data: {
      labels: ['Yeahs', 'Views', 'Downloads', 'Remixes'],
      datasets: [
        {
          label: 'Total',
          data: [
            stats.total_yeahs,
            stats.total_views,
            stats.total_downloads,
            stats.remix_received_count,
          ],
          backgroundColor: colors.accent,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: colors.textMuted },
          grid: { display: false },
        },
        y: {
          ticks: { color: colors.textMuted, precision: 0 },
          grid: { color: colors.border },
          beginAtZero: true,
        },
      },
    },
  });
  chartInstances.push(engagementChart);

  const privateUploads = Math.max(
    0,
    stats.upload_count - stats.public_upload_count,
  );
  const uploadsChart = new Chart(uploads.canvas, {
    type: 'doughnut',
    data: {
      labels: ['Public', 'Private'],
      datasets: [
        {
          data: [stats.public_upload_count, privateUploads],
          backgroundColor: [colors.accent, colors.textMuted],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.text, boxWidth: 12, padding: 16 },
        },
      },
    },
  });
  chartInstances.push(uploadsChart);

  const sorted = [...collections]
    .sort((a, b) => (b.item_count ?? 0) - (a.item_count ?? 0))
    .slice(0, 8);

  const collectionsChart = new Chart(collectionsPanel.canvas, {
    type: 'bar',
    data: {
      labels: sorted.length
        ? sorted.map((c) =>
            c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name,
          )
        : ['No collections'],
      datasets: [
        {
          label: 'Miis',
          data: sorted.length ? sorted.map((c) => c.item_count ?? 0) : [0],
          backgroundColor: colors.accent,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: colors.textMuted, maxRotation: 45 },
          grid: { display: false },
        },
        y: {
          ticks: { color: colors.textMuted, precision: 0 },
          grid: { color: colors.border },
          beginAtZero: true,
        },
      },
    },
  });
  chartInstances.push(collectionsChart);
}

export function destroyCreatorDashboardCharts(): void {
  for (const chart of chartInstances) {
    chart.destroy();
  }
  chartInstances = [];
}
