import './HeroFloaters.css';
import { pastelCssVarByIndex } from '@/styles/pastelColors';
import { icon } from '@/utils/icon';

type ShapeKind = 'star' | 'circle' | 'triangle';

const FA_BY_KIND: Record<ShapeKind, string> = {
  star: 'star',
  circle: 'circle',
  triangle: 'caret-up',
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
  duration: number;
  delay: number;
  enterDelay: number;
}

const ORIGIN = { x: 0.5, y: 0.56 };
const SHAPE_COUNT = 14;
const MIN_GAP = 0.078;

const KINDS: ShapeKind[] = [
  'star',
  'star',
  'star',
  'circle',
  'circle',
  'triangle',
  'star',
  'circle',
  'triangle',
  'star',
  'circle',
  'triangle',
  'star',
  'circle',
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

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const kind = KINDS[i] ?? 'circle';
    const sizePx = 20 + Math.floor(seeded(i + 3) * 16);
    const r = sizePx / 200;
    const baseAngle = (i / SHAPE_COUNT) * Math.PI * 2 + (seeded(i + 11) - 0.5) * 0.4;

    for (let ring = 0; ring < 6; ring++) {
      const dist = 0.16 + ring * 0.052 + seeded(i + ring * 5) * 0.028;
      const angle = baseAngle + (seeded(i * 7 + ring) - 0.5) * 0.12;
      const x = ORIGIN.x + Math.cos(angle) * dist;
      const y = ORIGIN.y + Math.sin(angle) * dist * 0.88;

      if (x < 0.05 || x > 0.95 || y < 0.06 || y > 0.94) continue;
      if (collides(x, y, r, placed)) continue;

      placed.push({ x, y, r });
      const drift = 12 + seeded(i + 29) * 20;
      specs.push({
        kind,
        x,
        y,
        sizePx,
        colorIndex: i + Math.floor(seeded(i + 50) * 6),
        rotate: -28 + seeded(i + 60) * 56,
        opacity: 0.32 + seeded(i + 70) * 0.22,
        tx1: `${(Math.cos(angle) * drift).toFixed(2)}px`,
        ty1: `${(Math.sin(angle) * drift).toFixed(2)}px`,
        duration: 16 + seeded(i + 80) * 18,
        delay: -(seeded(i + 90) * 22),
        enterDelay: 0.38 + i * 0.045,
      });
      break;
    }
  }

  return specs;
}

export function createHeroFloaters(): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'hero__floaters';
  layer.setAttribute('aria-hidden', 'true');

  for (const spec of layoutFloaters()) {
    const el = document.createElement('span');
    el.className = `hero__floater hero__floater--${spec.kind}`;
    el.innerHTML = icon(FA_BY_KIND[spec.kind], 'hero__floater-icon');
    el.style.setProperty('--fx', String(spec.x));
    el.style.setProperty('--fy', String(spec.y));
    el.style.setProperty('--size', `${spec.sizePx}px`);
    el.style.setProperty('--floater-color', pastelCssVarByIndex(spec.colorIndex));
    el.style.setProperty('--floater-opacity', String(spec.opacity));
    el.style.setProperty('--float-rotate', `${spec.rotate.toFixed(1)}deg`);
    el.style.setProperty('--tx1', spec.tx1);
    el.style.setProperty('--ty1', spec.ty1);
    el.style.setProperty('--float-duration', `${spec.duration.toFixed(1)}s`);
    el.style.setProperty('--float-delay', `${spec.delay.toFixed(2)}s`);
    el.style.setProperty('--floater-enter', `${spec.enterDelay.toFixed(2)}s`);
    layer.appendChild(el);
  }

  return layer;
}
