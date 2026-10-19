import { FluidSolver, type FluidMode } from '../math/fluid';

export type FluidView = 'dye' | 'speed' | 'pressure' | 'vorticity';
export type ObstacleShape = 'cylinder' | 'plate' | 'wing' | 'pair' | 'none';

export type FluidIn =
  | { type: 'init'; nx: number; ny: number; mode: FluidMode; obstacle: ObstacleShape }
  | { type: 'params'; mu: number; rho: number; inflow: number; vorticity: number; smoke: boolean }
  | { type: 'splat'; x: number; y: number; fx: number; fy: number; r: number; color: [number, number, number] | null }
  | { type: 'paint'; x: number; y: number; r: number; value: number }
  | { type: 'obstacle'; shape: ObstacleShape }
  | { type: 'mode'; mode: FluidMode }
  | { type: 'reset' }
  | { type: 'frame'; steps: number; view: FluidView };

export interface FluidFrame {
  type: 'frame';
  nx: number;
  ny: number;
  img: Uint8ClampedArray;
  uc: Float32Array;
  vc: Float32Array;
  solid: Uint8Array;
  maxDiv: number;
  maxSpeed: number;
  steps: number;
}

let f: FluidSolver | null = null;
let smoke = true;
let obstacle: ObstacleShape = 'cylinder';
let totalSteps = 0;

function placeObstacle(shape: ObstacleShape) {
  if (!f) return;
  obstacle = shape;
  f.clearObstacles();
  const { nx, ny } = f;
  const cy = ny / 2;
  const cx = f.mode === 'tunnel' ? nx * 0.22 : nx * 0.5;
  const R = ny * 0.085;
  if (shape === 'cylinder') f.addCircleObstacle(cx, cy + 0.6, R);
  else if (shape === 'plate') f.addRectObstacle(cx - 1, cy - R * 1.6, cx + 2, cy + R * 1.6);
  else if (shape === 'pair') {
    f.addCircleObstacle(cx, cy - R * 1.6, R * 0.8);
    f.addCircleObstacle(cx + R * 0.5, cy + R * 1.6, R * 0.8);
  } else if (shape === 'wing') {
    // a cambered, tilted ellipse (≈ aerofoil at angle of attack)
    const L = ny * 0.36;
    const T = ny * 0.06;
    const ang = -0.22;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = i + 0.5 - cx;
        const y = j + 0.5 - cy;
        const xr = x * Math.cos(ang) + y * Math.sin(ang);
        const yr = -x * Math.sin(ang) + y * Math.cos(ang);
        const s = xr / L + 0.5; // 0..1 along chord
        if (s < 0 || s > 1) continue;
        const camber = 0.08 * L * 4 * s * (1 - s);
        const thick = T * 2.6 * Math.sqrt(s) * (1 - s);
        if (Math.abs(yr - camber) < thick) f.setSolid(i, j, 1);
      }
  }
  f.reset();
  // tiny asymmetric nudge so vortex shedding starts promptly
  if (f.mode === 'tunnel' && shape !== 'none') f.splat(cx + R * 2.5, cy + 2, 0, 0.6, 3, null);
}

function render(view: FluidView): FluidFrame {
  const s = f!;
  const { nx, ny } = s;
  const img = new Uint8ClampedArray(nx * ny * 4);
  const uc = new Float32Array(nx * ny);
  const vc = new Float32Array(nx * ny);
  const W = nx + 1;
  let maxSpeed = 1e-6;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      uc[k] = 0.5 * (s.u[j * W + i] + s.u[j * W + i + 1]);
      vc[k] = 0.5 * (s.v[j * nx + i] + s.v[(j + 1) * nx + i]);
      const sp = Math.hypot(uc[k], vc[k]);
      if (sp > maxSpeed) maxSpeed = sp;
    }
  let pmax = 1e-9;
  if (view === 'pressure') for (let k = 0; k < s.size; k++) if (!s.solid[k]) pmax = Math.max(pmax, Math.abs(s.p[k]));
  if (view === 'vorticity') s.computeCurl();
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      // image row 0 is the top of the screen; grid row 0 is the bottom
      const o = ((ny - 1 - j) * nx + i) * 4;
      if (s.solid[k]) {
        img[o] = 200;
        img[o + 1] = 210;
        img[o + 2] = 235;
        img[o + 3] = 255;
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      if (view === 'dye') {
        const R = s.dye[k * 3];
        const G = s.dye[k * 3 + 1];
        const B = s.dye[k * 3 + 2];
        // soft tone-mapping keeps dense dye from clipping harshly
        r = 255 * (1 - Math.exp(-R * 1.4));
        g = 255 * (1 - Math.exp(-G * 1.4));
        b = 255 * (1 - Math.exp(-B * 1.4));
        r += 4;
        g += 6;
        b += 14;
      } else if (view === 'speed') {
        const t = Math.min(1, Math.hypot(uc[k], vc[k]) / maxSpeed);
        r = 255 * Math.min(1, 1.7 * t * t);
        g = 255 * Math.min(1, Math.max(0, 1.6 * t - 0.25));
        b = 60 + 195 * Math.sin(Math.PI * Math.min(1, t * 1.1));
      } else if (view === 'pressure') {
        const t = s.p[k] / pmax;
        if (t > 0) {
          r = 30 + 225 * t;
          g = 30 + 120 * t;
          b = 40;
        } else {
          r = 20;
          g = 40 - 10 * t * 140;
          b = 50 - 205 * t;
        }
      } else {
        const t = Math.max(-1, Math.min(1, s.curl[k] * 6));
        if (t > 0) {
          r = 20 + 235 * t;
          g = 30 + 40 * t;
          b = 60 + 120 * t;
        } else {
          r = 20;
          g = 30 - 170 * t;
          b = 60 - 195 * t;
        }
      }
      img[o] = r;
      img[o + 1] = g;
      img[o + 2] = b;
      img[o + 3] = 255;
    }
  return { type: 'frame', nx, ny, img, uc, vc, solid: s.solid.slice(), maxDiv: s.maxDivergence, maxSpeed, steps: totalSteps };
}

const SMOKE = [
  [0.95, 0.35, 0.75],
  [0.25, 0.85, 1.0],
  [1.0, 0.8, 0.35],
] as [number, number, number][];

self.onmessage = (e: MessageEvent<FluidIn>) => {
  const m = e.data;
  if (m.type === 'init') {
    f = new FluidSolver(m.nx, m.ny);
    f.mode = m.mode;
    placeObstacle(m.obstacle);
    totalSteps = 0;
    return;
  }
  if (!f) return;
  switch (m.type) {
    case 'params':
      f.mu = m.mu;
      f.rho = m.rho;
      f.inflow = m.inflow;
      f.vorticity = m.vorticity;
      smoke = m.smoke;
      break;
    case 'splat':
      f.splat(m.x, m.y, m.fx, m.fy, m.r, m.color);
      break;
    case 'paint':
      for (let j = Math.floor(m.y - m.r); j <= Math.ceil(m.y + m.r); j++)
        for (let i = Math.floor(m.x - m.r); i <= Math.ceil(m.x + m.r); i++)
          if ((i + 0.5 - m.x) ** 2 + (j + 0.5 - m.y) ** 2 <= m.r * m.r) f.setSolid(i, j, m.value);
      obstacle = 'none';
      break;
    case 'obstacle':
      placeObstacle(m.shape);
      break;
    case 'mode':
      f.mode = m.mode;
      placeObstacle(obstacle);
      break;
    case 'reset':
      placeObstacle(obstacle);
      totalSteps = 0;
      break;
    case 'frame': {
      for (let s = 0; s < m.steps; s++) {
        if (smoke && f.mode === 'tunnel') {
          const lines = 9;
          for (let l = 0; l < lines; l++) {
            const y = ((l + 0.5) / lines) * f.ny;
            f.splat(1.5, y, 0, 0, 1.1, SMOKE[l % 3].map((c) => c * 0.45) as [number, number, number]);
          }
        }
        f.step(1);
        totalSteps++;
      }
      const fr = render(m.view);
      (self as unknown as Worker).postMessage(fr, [fr.img.buffer, fr.uc.buffer, fr.vc.buffer, fr.solid.buffer]);
      break;
    }
  }
};
