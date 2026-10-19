/**
 * Finite-difference time-domain solvers for the linear wave equation
 *   ∂²u/∂t² = c²∇²u − γ ∂u/∂t
 * using the leapfrog (explicit central-difference) scheme. It is second-order accurate and
 * stable when the Courant number C = c·Δt/Δx satisfies C ≤ 1 (1-D) or C ≤ 1/√2 (2-D).
 * Callers choose Δt automatically from c to respect the bound.
 */
export type WaveBoundary = 'fixed' | 'free' | 'absorbing';

export class Wave2D {
  readonly n: number;
  u: Float32Array;
  uPrev: Float32Array;
  uNext: Float32Array;
  sponge: Float32Array;
  wall: Uint8Array; // barrier cells (u held at 0)
  c = 1; // wave speed in cells per unit time
  damping = 0; // γ
  boundary: WaveBoundary = 'fixed';
  time = 0;

  constructor(n: number) {
    this.n = n;
    this.u = new Float32Array(n * n);
    this.uPrev = new Float32Array(n * n);
    this.uNext = new Float32Array(n * n);
    this.sponge = new Float32Array(n * n);
    this.wall = new Uint8Array(n * n);
    this.buildSponge();
  }

  private buildSponge() {
    const n = this.n;
    const w = Math.max(6, Math.floor(n * 0.1));
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const d = Math.min(i, j, n - 1 - i, n - 1 - j);
        const s = d < w ? (w - d) / w : 0;
        this.sponge[j * n + i] = 0.35 * s * s;
      }
  }

  reset() {
    this.u.fill(0);
    this.uPrev.fill(0);
    this.uNext.fill(0);
    this.time = 0;
  }

  /** Largest stable time step for the current speed (with a safety margin). */
  get dt() {
    return (0.9 / Math.SQRT2) / Math.max(this.c, 1e-6);
  }
  get courant() {
    return this.c * this.dt;
  }

  /** Add a Gaussian displacement bump (both time levels, so it starts at rest). */
  pulse(cx: number, cy: number, amp: number, radius: number) {
    const n = this.n;
    const r2 = radius * radius;
    const ext = Math.ceil(radius * 3);
    for (let j = Math.max(1, Math.floor(cy - ext)); j < Math.min(n - 1, cy + ext); j++)
      for (let i = Math.max(1, Math.floor(cx - ext)); i < Math.min(n - 1, cx + ext); i++) {
        const k = j * n + i;
        if (this.wall[k]) continue;
        const g = amp * Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / r2);
        this.u[k] += g;
        this.uPrev[k] += g;
      }
  }

  /** Drive a point source sinusoidally (a "hard" source). */
  drive(cx: number, cy: number, value: number, radius = 1.5) {
    const n = this.n;
    for (let j = Math.floor(cy - radius); j <= Math.ceil(cy + radius); j++)
      for (let i = Math.floor(cx - radius); i <= Math.ceil(cx + radius); i++) {
        if (i < 1 || j < 1 || i >= n - 1 || j >= n - 1) continue;
        if ((i - cx) ** 2 + (j - cy) ** 2 <= radius * radius) this.u[j * n + i] = value;
      }
  }

  /** Initialise a standing eigenmode sin(mπx/L) sin(nπy/L) of the fixed square membrane. */
  mode(m: number, q: number, amp: number) {
    const n = this.n;
    this.reset();
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const val = amp * Math.sin((m * Math.PI * i) / (n - 1)) * Math.sin((q * Math.PI * j) / (n - 1));
        this.u[j * n + i] = val;
      }
    // start at rest: u_prev = u adjusted by one step of the exact mode frequency
    const dt = this.dt;
    const k2 = ((m * Math.PI) / (n - 1)) ** 2 + ((q * Math.PI) / (n - 1)) ** 2;
    const omega = this.c * Math.sqrt(k2);
    const f = Math.cos(omega * dt);
    for (let k = 0; k < n * n; k++) this.uPrev[k] = this.u[k] * f;
  }

  step() {
    const { n, u, uPrev, uNext, wall, sponge } = this;
    const dt = this.dt;
    const c2 = (this.c * dt) ** 2;
    const g = this.damping * dt * 0.5;
    const absorbing = this.boundary === 'absorbing';
    for (let j = 1; j < n - 1; j++) {
      const row = j * n;
      for (let i = 1; i < n - 1; i++) {
        const k = row + i;
        if (wall[k]) {
          uNext[k] = 0;
          continue;
        }
        const lap = u[k - 1] + u[k + 1] + u[k - n] + u[k + n] - 4 * u[k];
        const gg = g + (absorbing ? sponge[k] : 0);
        uNext[k] = (2 * u[k] - (1 - gg) * uPrev[k] + c2 * lap) / (1 + gg);
      }
    }
    // boundaries
    if (this.boundary === 'free') {
      for (let i = 0; i < n; i++) {
        uNext[i] = uNext[n + i];
        uNext[(n - 1) * n + i] = uNext[(n - 2) * n + i];
        uNext[i * n] = uNext[i * n + 1];
        uNext[i * n + n - 1] = uNext[i * n + n - 2];
      }
    } else {
      for (let i = 0; i < n; i++) {
        uNext[i] = 0;
        uNext[(n - 1) * n + i] = 0;
        uNext[i * n] = 0;
        uNext[i * n + n - 1] = 0;
      }
    }
    this.uPrev = u;
    this.u = uNext;
    this.uNext = uPrev;
    this.time += dt;
  }

  energy(): number {
    const { n, u, uPrev } = this;
    const dt = this.dt;
    let e = 0;
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        // discrete energy exactly conserved by leapfrog: kinetic term at the half step plus
        // potential term from the product of forward differences at the two time levels
        const vt = (u[k] - uPrev[k]) / dt;
        const gx = (u[k + 1] - u[k]) * (uPrev[k + 1] - uPrev[k]);
        const gy = (u[k + n] - u[k]) * (uPrev[k + n] - uPrev[k]);
        e += 0.5 * vt * vt + 0.5 * this.c * this.c * (gx + gy);
      }
    return e;
  }
}

export class Wave1D {
  readonly n: number;
  u: Float64Array;
  uPrev: Float64Array;
  uNext: Float64Array;
  c = 1;
  damping = 0;
  left: 'fixed' | 'free' = 'fixed';
  right: 'fixed' | 'free' = 'fixed';
  time = 0;

  constructor(n: number) {
    this.n = n;
    this.u = new Float64Array(n);
    this.uPrev = new Float64Array(n);
    this.uNext = new Float64Array(n);
  }
  get dt() {
    return 0.95 / Math.max(this.c, 1e-6);
  }
  reset() {
    this.u.fill(0);
    this.uPrev.fill(0);
    this.time = 0;
  }
  /** Displacement initial condition (released from rest). */
  setShape(fn: (x: number) => number) {
    for (let i = 0; i < this.n; i++) {
      const x = i / (this.n - 1);
      this.u[i] = fn(x);
      this.uPrev[i] = this.u[i];
    }
  }
  /** Pulse that travels right: u(x,0)=g(x), u(x,−Δt)=g(x+cΔt). */
  travellingPulse(center: number, width: number, amp: number) {
    const n = this.n;
    const shift = this.c * this.dt;
    for (let i = 0; i < n; i++) {
      this.u[i] += amp * Math.exp(-(((i - center) / width) ** 2));
      this.uPrev[i] += amp * Math.exp(-(((i + shift - center) / width) ** 2));
    }
  }
  /** Standing mode n of a fixed–fixed string starting at rest. */
  harmonic(m: number, amp: number) {
    this.reset();
    const n = this.n;
    const dt = this.dt;
    const omega = this.c * ((m * Math.PI) / (n - 1));
    for (let i = 0; i < n; i++) {
      this.u[i] = amp * Math.sin((m * Math.PI * i) / (n - 1));
      this.uPrev[i] = this.u[i] * Math.cos(omega * dt);
    }
  }
  step() {
    const { n, u, uPrev, uNext } = this;
    const dt = this.dt;
    const c2 = (this.c * dt) ** 2;
    const g = this.damping * dt * 0.5;
    for (let i = 1; i < n - 1; i++) {
      uNext[i] = (2 * u[i] - (1 - g) * uPrev[i] + c2 * (u[i - 1] - 2 * u[i] + u[i + 1])) / (1 + g);
    }
    uNext[0] = this.left === 'fixed' ? 0 : uNext[1];
    uNext[n - 1] = this.right === 'fixed' ? 0 : uNext[n - 2];
    this.uPrev = u;
    this.u = uNext;
    this.uNext = uPrev;
    this.time += dt;
  }
}
