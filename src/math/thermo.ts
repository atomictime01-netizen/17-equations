import { lnFactorial } from './rng';

/**
 * Hard-disc gas in a box with an optional central partition.
 * Elastic collisions with walls and between particles (equal masses) conserve kinetic energy,
 * so the simulated gas is an isolated system. Entropy is computed statistically from the
 * coarse-grained macrostate (how many particles occupy each spatial cell).
 */
export class GasBox {
  n = 0;
  x: Float64Array = new Float64Array(0);
  y: Float64Array = new Float64Array(0);
  vx: Float64Array = new Float64Array(0);
  vy: Float64Array = new Float64Array(0);
  species: Uint8Array = new Uint8Array(0);
  radius = 0.006;
  partition = true; // wall at x = 0.5
  width = 1;
  height = 1;
  collisions = true;
  private cellHead: Int32Array = new Int32Array(0);
  private cellNext: Int32Array = new Int32Array(0);

  init(n: number, opts: { leftFraction: number; speed: number; twoSpecies: boolean; seed: () => number }) {
    const { leftFraction, speed, twoSpecies, seed } = opts;
    this.n = n;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.species = new Uint8Array(n);
    this.cellNext = new Int32Array(n);
    this.radius = Math.min(0.012, 0.32 / Math.sqrt(n * 6));
    const r = this.radius;
    const nLeft = Math.round(n * leftFraction);
    for (let i = 0; i < n; i++) {
      const left = i < nLeft;
      const x0 = left ? r : 0.5 + r;
      const x1 = left ? 0.5 - r : 1 - r;
      this.x[i] = x0 + seed() * (x1 - x0);
      this.y[i] = r + seed() * (1 - 2 * r);
      const a = seed() * Math.PI * 2;
      // speeds drawn from a 2-D Maxwell–Boltzmann (Rayleigh) distribution
      const s = speed * Math.sqrt(-2 * Math.log(1 - seed() * 0.999999)) * 0.7;
      this.vx[i] = Math.cos(a) * s;
      this.vy[i] = Math.sin(a) * s;
      this.species[i] = twoSpecies ? (left ? 0 : 1) : 0;
    }
  }

  reverseVelocities() {
    for (let i = 0; i < this.n; i++) {
      this.vx[i] = -this.vx[i];
      this.vy[i] = -this.vy[i];
    }
  }

  kineticEnergy() {
    let e = 0;
    for (let i = 0; i < this.n; i++) e += 0.5 * (this.vx[i] ** 2 + this.vy[i] ** 2);
    return e;
  }

  step(dt: number) {
    const { n, x, y, vx, vy } = this;
    const r = this.radius;
    for (let i = 0; i < n; i++) {
      const px = x[i];
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      if (x[i] < r) { x[i] = 2 * r - x[i]; vx[i] = Math.abs(vx[i]); }
      if (x[i] > 1 - r) { x[i] = 2 * (1 - r) - x[i]; vx[i] = -Math.abs(vx[i]); }
      if (y[i] < r) { y[i] = 2 * r - y[i]; vy[i] = Math.abs(vy[i]); }
      if (y[i] > 1 - r) { y[i] = 2 * (1 - r) - y[i]; vy[i] = -Math.abs(vy[i]); }
      if (this.partition) {
        // reflect off the central wall (both faces)
        if (px <= 0.5 && x[i] > 0.5 - r) { x[i] = 2 * (0.5 - r) - x[i]; vx[i] = -Math.abs(vx[i]); }
        else if (px >= 0.5 && x[i] < 0.5 + r) { x[i] = 2 * (0.5 + r) - x[i]; vx[i] = Math.abs(vx[i]); }
      }
    }
    if (this.collisions) this.collide();
  }

  private collide() {
    const { n, x, y, vx, vy } = this;
    const r = this.radius;
    const d = 2 * r;
    const g = Math.max(1, Math.floor(1 / d));
    if (this.cellHead.length !== g * g) this.cellHead = new Int32Array(g * g);
    const head = this.cellHead;
    const next = this.cellNext;
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(g - 1, Math.max(0, Math.floor(x[i] * g)));
      const cy = Math.min(g - 1, Math.max(0, Math.floor(y[i] * g)));
      const c = cy * g + cx;
      next[i] = head[c];
      head[c] = i;
    }
    for (let i = 0; i < n; i++) {
      const cx = Math.min(g - 1, Math.max(0, Math.floor(x[i] * g)));
      const cy = Math.min(g - 1, Math.max(0, Math.floor(y[i] * g)));
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= g || ny >= g) continue;
          for (let j = head[ny * g + nx]; j !== -1; j = next[j]) {
            if (j <= i) continue;
            const dx = x[j] - x[i];
            const dy = y[j] - y[i];
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= d * d || dist2 === 0) continue;
            // do not collide through the partition
            if (this.partition && (x[i] - 0.5) * (x[j] - 0.5) < 0) continue;
            const dist = Math.sqrt(dist2);
            const nxv = dx / dist;
            const nyv = dy / dist;
            const rel = (vx[j] - vx[i]) * nxv + (vy[j] - vy[i]) * nyv;
            if (rel >= 0) continue; // separating
            // equal-mass elastic collision: exchange normal components
            vx[i] += rel * nxv;
            vy[i] += rel * nyv;
            vx[j] -= rel * nxv;
            vy[j] -= rel * nyv;
            // push apart to avoid sticking
            const overlap = (d - dist) * 0.5;
            x[i] -= nxv * overlap;
            y[i] -= nyv * overlap;
            x[j] += nxv * overlap;
            y[j] += nyv * overlap;
          }
        }
    }
  }

  /** Occupation counts in a gx × gy coarse-graining grid (optionally only one species). */
  occupancy(gx: number, gy: number, species = -1): Int32Array {
    const counts = new Int32Array(gx * gy);
    for (let i = 0; i < this.n; i++) {
      if (species >= 0 && this.species[i] !== species) continue;
      const cx = Math.min(gx - 1, Math.max(0, Math.floor(this.x[i] * gx)));
      const cy = Math.min(gy - 1, Math.max(0, Math.floor(this.y[i] * gy)));
      counts[cy * gx + cx]++;
    }
    return counts;
  }

  countLeft(species = -1) {
    let c = 0;
    for (let i = 0; i < this.n; i++) if (this.x[i] < 0.5 && (species < 0 || this.species[i] === species)) c++;
    return c;
  }
}

/**
 * Boltzmann entropy of a coarse-grained macrostate, S/k_B = ln Ω,
 * where Ω = N! / Π nᵢ! counts the ways of assigning N distinguishable particles to cells
 * with the observed occupation numbers nᵢ.
 */
export function lnMultiplicity(counts: ArrayLike<number>): number {
  let total = 0;
  let s = 0;
  for (let i = 0; i < counts.length; i++) {
    total += counts[i];
    s -= lnFactorial(counts[i]);
  }
  return s + lnFactorial(total);
}

/** Maximum ln Ω for N particles spread evenly over M cells. */
export function maxLnMultiplicity(N: number, M: number): number {
  const base = Math.floor(N / M);
  const extra = N - base * M;
  const counts = new Array(M).fill(base);
  for (let i = 0; i < extra; i++) counts[i]++;
  return lnMultiplicity(counts);
}

/** Probability that all N independent particles are found in the left half: 2^−N. */
export const probAllLeft = (N: number) => Math.pow(2, -N);
