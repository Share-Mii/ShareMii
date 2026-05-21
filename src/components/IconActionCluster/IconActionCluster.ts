import './IconActionCluster.css';
import {
  createIconActionButton,
  type IconActionButtonOptions,
} from '@/components/IconActionButton/IconActionButton';

export type IconActionClusterLayout = 'vertical' | 'horizontal';

export interface IconActionClusterOptions {
  layout?: IconActionClusterLayout;
  className?: string;
  buttons: IconActionButtonOptions[];
}

export function createIconActionCluster(
  opts: IconActionClusterOptions,
): HTMLElement {
  const cluster = document.createElement('div');
  cluster.className = [
    'icon-action-cluster',
    `icon-action-cluster--${opts.layout ?? 'vertical'}`,
    opts.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  for (const btnOpts of opts.buttons) {
    cluster.appendChild(createIconActionButton(btnOpts));
  }

  return cluster;
}
