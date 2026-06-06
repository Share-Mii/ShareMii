import './HeroFloaters.css';
import { pastelCssVarByIndex } from '@/styles/pastelColors';
import { icon } from '@/utils/icon';

type ShapeKind = 'star' | 'circle' | 'triangle' | 'heart' | 'diamond' | 'sparkle';

const FA_BY_KIND: Partial<Record<ShapeKind, string>> = {
  star: 'star',
  circle: 'circle',
  heart: 'heart',
  sparkle: 'wand-magic-sparkles',
};

interface Placed {
  x: number;
  y: number;
  r: number;
}

interface FloaterSpec {
  kind: ShapeKind;
  x: number;
  y: number;
  sizePx: number;
  colorIndex: number;
  rotate: number;
  opacity: number;
  tx1: string;
  ty1: string;
  tx2: string;
  ty2: string;
  rot2: number;
  duration: number;
  delay: number;
  enterDelay: number;
}

const SHAPE_COUNT = 24;
const MIN_GAP = 0.065;

/** Spread across full hero — left copy column + right visual, avoiding dead center. */
const ANCHOR_SLOTS: Array<{ x: number; y: number; weight: number }> = [
  { x: 0.06, y: 0.14, weight: 1 },
  { x: 0.14, y: 0.32, weight: 1.1 },
  { x: 0.08, y: 0.52, weight: 1 },
  { x: 0.18, y: 0.72, weight: 1 },
  { x: 0.28, y: 0.18, weight: 0.9 },
  { x: 0.34, y: 0.48, weight: 0.85 },
  { x: 0.24, y: 0.86, weight: 1 },
  { x: 0.42, y: 0.1, weight: 0.8 },
  { x: 0.48, y: 0.78, weight: 0.85 },
  { x: 0.58, y: 0.22, weight: 1 },
  { x: 0.72, y: 0.1, weight: 1 },
  { x: 0.88, y: 0.18, weight: 1.1 },
  { x: 0.94, y: 0.38, weight: 1 },
  { x: 0.82, y: 0.52, weight: 1 },
  { x: 0.92, y: 0.68, weight: 1 },
  { x: 0.76, y: 0.82, weight: 1 },
  { x: 0.62, y: 0.88, weight: 0.95 },
  { x: 0.54, y: 0.58, weight: 0.75 },
  { x: 0.66, y: 0.38, weight: 0.8 },
  { x: 0.78, y: 0.28, weight: 0.9 },
  { x: 0.38, y: 0.62, weight: 0.7 },
  { x: 0.52, y: 0.42, weight: 0.65 },
  { x: 0.7, y: 0.62, weight: 0.75 },
  { x: 0.12, y: 0.9, weight: 1 },
];

const KIND_CYCLE: ShapeKind[] = [
  'star',
  'circle',
  'sparkle',
  'heart',
  'triangle',
  'diamond',
  'star',
  'circle',
  'sparkle',
  'triangle',
  'heart',
  'circle',
  'diamond',
  'star',
  'sparkle',
  'circle',
  'triangle',
  'heart',
  'star',
  'diamond',
  'circle',
  'sparkle',
  'triangle',
  'heart',
];

function seeded(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function collides(x: number, y: number, r: number, placed: Placed[]): boolean {
  for (const p of placed) {
    if (Math.hypot(x - p.x, y - p.y) < r + p.r + MIN_GAP) return true;
  }
  return false;
}

function layoutFloaters(): FloaterSpec[] {
  const placed: Placed[] = [];
  const specs: FloaterSpec[] = [];
  const slotOrder = [...ANCHOR_SLOTS].sort(
    (a, b) => seeded(a.x * 100 + a.y) - seeded(b.x * 100 + b.y),
  );

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const kind = KIND_CYCLE[i] ?? 'circle';
    const slot = slotOrder[i % slotOrder.length]!;
    const sizePx =
      kind === 'sparkle' || kind === 'diamond'
        ? 14 + Math.floor(seeded(i + 3) * 10)
        : 18 + Math.floor(seeded(i + 3) * 14);
    const r = sizePx / 220;

    let placedOne = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const jitter = (attempt + 1) * 0.018;
      const x = Math.min(
        0.96,
        Math.max(0.04, slot.x + (seeded(i * 13 + attempt) - 0.5) * jitter * 2),
      );
      const y = Math.min(
        0.94,
        Math.max(0.06, slot.y + (seeded(i * 17 + attempt) - 0.5) * jitter * 2),
      );

      if (collides(x, y, r * slot.weight, placed)) continue;

      placed.push({ x, y, r: r * slot.weight });
      const drift = 6 + seeded(i + 29) * 10;
      const angle = seeded(i + 40) * Math.PI * 2;
      const angle2 = angle + 1.2 + seeded(i + 41) * 0.8;
      const isLeft = x < 0.45;
      const opacityBase = isLeft ? 0.18 : 0.28;
      const opacity = opacityBase + seeded(i + 70) * (isLeft ? 0.12 : 0.18);

      specs.push({
        kind,
        x,
        y,
        sizePx,
        colorIndex: i + Math.floor(seeded(i + 50) * 6),
        rotate: -22 + seeded(i + 60) * 44,
        opacity,
        tx1: `${(Math.cos(angle) * drift).toFixed(1)}px`,
        ty1: `${(Math.sin(angle) * drift).toFixed(1)}px`,
        tx2: `${(Math.cos(angle2) * drift * 0.65).toFixed(1)}px`,
        ty2: `${(Math.sin(angle2) * drift * 0.65).toFixed(1)}px`,
        rot2: -6 + seeded(i + 75) * 12,
        duration: 22 + seeded(i + 80) * 16,
        delay: -(seeded(i + 90) * 24),
        enterDelay: 0.32 + i * 0.035,
      });
      placedOne = true;
      break;
    }

    if (!placedOne) {
      const x = slot.x;
      const y = slot.y;
      placed.push({ x, y, r });
      specs.push({
        kind,
        x,
        y,
        sizePx,
        colorIndex: i,
        rotate: 0,
        opacity: 0.22,
        tx1: '0px',
        ty1: '0px',
        tx2: '4px',
        ty2: '-3px',
        rot2: 4,
        duration: 26,
        delay: 0,
        enterDelay: 0.4 + i * 0.03,
      });
    }
  }

  return specs;
}

function shapeMarkup(kind: ShapeKind): string {
  const fa = FA_BY_KIND[kind];
  if (fa) return icon(fa, 'hero__floater-icon');
  return '';
}

export function createHeroFloaters(): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'hero__floaters';
  layer.setAttribute('aria-hidden', 'true');

  for (const spec of layoutFloaters()) {
    const el = document.createElement('span');
    el.className = `hero__floater hero__floater--${spec.kind}`;
    const markup = shapeMarkup(spec.kind);
    if (markup) el.innerHTML = markup;
    el.style.setProperty('--fx', String(spec.x));
    el.style.setProperty('--fy', String(spec.y));
    el.style.setProperty('--size', `${spec.sizePx}px`);
    el.style.setProperty('--floater-color', pastelCssVarByIndex(spec.colorIndex));
    el.style.setProperty('--floater-opacity', String(spec.opacity));
    el.style.setProperty('--float-rotate', `${spec.rotate.toFixed(1)}deg`);
    el.style.setProperty('--tx1', spec.tx1);
    el.style.setProperty('--ty1', spec.ty1);
    el.style.setProperty('--tx2', spec.tx2);
    el.style.setProperty('--ty2', spec.ty2);
    el.style.setProperty('--rot2', `${spec.rot2.toFixed(1)}deg`);
    el.style.setProperty('--float-duration', `${spec.duration.toFixed(1)}s`);
    el.style.setProperty('--float-delay', `${spec.delay.toFixed(2)}s`);
    el.style.setProperty('--floater-enter', `${spec.enterDelay.toFixed(2)}s`);
    layer.appendChild(el);
  }

  return layer;
}
