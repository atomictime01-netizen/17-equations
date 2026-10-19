/**
 * Two-dimensional incompressible Navier–Stokes solver on a staggered (MAC) grid,
 * following the "Stable Fluids" operator-splitting approach (Stam 1999; Bridson 2015).
 *
 *   ∂u/∂t + (u·∇)u = −(1/ρ)∇p + ν∇²u + f/ρ,     ∇·u = 0,     ν = μ/ρ
 *
 * Each step:
 *   1. body force       explicit, acceleration f/ρ (mouse "splats")
 *   2. viscosity        implicit diffusion, Gauss–Seidel
 *   3. advection        semi-Lagrangian back-tracing (unconditionally stable, slightly diffusive)
 *   4. projection       pressure Poisson equation solved by SOR; subtracting ∇p makes the
 *                       discrete divergence (exactly consistent on the MAC grid) vanish
 * Horizontal velocities u live on vertical cell faces, vertical velocities v on horizontal faces,
 * pressure and dye at cell centres. Lengths are in cells, time in steps: lattice units.
 */
export type FluidMode = 'tank' | 'tunnel';

export class FluidSolver {
  readonly nx: number;
  readonly ny: number;
  readonly size: number;
  /** u[(i) + j*(nx+1)] at x = i, y = j + ½ */
  u: Float64Array;
  /** v[i + j*nx] at x = i + ½, y = j */
  v: Float64Array;
  u0: Float64Array;
  v0: Float64Array;
  uFixed: Uint8Array;
  vFixed: Uint8Array;
  p: Float64Array;
  div: Float64Array;
  curl: Float64Array;
  dye: Float64Array; // RGB per cell
  dye0: Float64Array;
  solid: Uint8Array;
  mode: FluidMode = 'tunnel';
  inflow = 0.9; // tunnel inflow speed (cells/step)
  mu = 0.0; // dynamic viscosity (lattice units)
  rho = 1; // density
  vorticity = 0; // vorticity-confinement strength (numerical correction, 0 = off)
  dyeFade = 0.998;
  pressureIters = 30;
  omega = 1.85;
  maxDivergence = 0;
  private fixedDirty = true;

  constructor(nx: number, ny: number) {
    this.nx = nx;
    this.ny = ny;
    this.size = nx * ny;
    this.u = new Float64Array((nx + 1) * ny);
    this.v = new Float64Array(nx * (ny + 1));
    this.u0 = new Float64Array((nx + 1) * ny);
    this.v0 = new Float64Array(nx * (ny + 1));
    this.uFixed = new Uint8Array((nx + 1) * ny);
    this.vFixed = new Uint8Array(nx * (ny + 1));
    this.p = new Float64Array(this.size);
    this.div = new Float64Array(this.size);
    this.curl = new Float64Array(this.size);
    this.dye = new Float64Array(this.size * 3);
    this.dye0 = new Float64Array(this.size * 3);
    this.solid = new Uint8Array(this.size);
  }

  get nu() {
    return this.mu / this.rho;
  }

  /** Mark faces whose normal velocity is prescribed (walls, obstacles, inflow). */
  private updateFixed() {
    const { nx, ny, solid, uFixed, vFixed } = this;
    const W = nx + 1;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= nx; i++) {
        const left = i - 1 >= 0 ? solid[j * nx + i - 1] : 1;
        const right = i < nx ? solid[j * nx + i] : 1;
        let fixed = left || right ? 1 : 0;
        if (this.mode === 'tunnel') {
          if (i === 0) fixed = 1; // inflow face
          if (i === nx) fixed = right && i < nx ? 1 : solid[j * nx + nx - 1]; // outflow face is free
        }
        uFixed[j * W + i] = fixed;
      }
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i < nx; i++) {
        const below = j - 1 >= 0 ? solid[(j - 1) * nx + i] : 1;
        const above = j < ny ? solid[j * nx + i] : 1;
        vFixed[j * nx + i] = below || above ? 1 : 0;
      }
    this.fixedDirty = false;
  }

  private enforceFixed() {
    if (this.fixedDirty) this.updateFixed();
    const { nx, ny, u, v, uFixed, vFixed } = this;
    const W = nx + 1;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= nx; i++) {
        const k = j * W + i;
        if (uFixed[k]) u[k] = this.mode === 'tunnel' && i === 0 && !this.solid[j * nx] ? this.inflow : 0;
      }
    for (let k = 0; k < v.length; k++) if (vFixed[k]) v[k] = 0;
  }

  reset() {
    this.u.fill(0);
    this.v.fill(0);
    this.p.fill(0);
    this.dye.fill(0);
    this.fixedDirty = true;
    if (this.mode === 'tunnel') {
      const W = this.nx + 1;
      for (let j = 0; j < this.ny; j++) for (let i = 0; i <= this.nx; i++) this.u[j * W + i] = this.inflow;
    }
    this.enforceFixed();
  }

  clearObstacles() {
    this.solid.fill(0);
    this.fixedDirty = true;
  }

  setSolid(i: number, j: number, value: number) {
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return;
    const k = j * this.nx + i;
    if (this.solid[k] === value) return;
    this.solid[k] = value;
    if (value) this.dye[k * 3] = this.dye[k * 3 + 1] = this.dye[k * 3 + 2] = 0;
    this.fixedDirty = true;
  }

  addCircleObstacle(cx: number, cy: number, r: number, value = 1) {
    for (let j = Math.floor(cy - r - 1); j <= Math.ceil(cy + r + 1); j++)
      for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r + 1); i++)
        if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r) this.setSolid(i, j, value);
  }

  addRectObstacle(x0: number, y0: number, x1: number, y1: number, value = 1) {
    for (let j = Math.floor(y0); j < Math.ceil(y1); j++) for (let i = Math.floor(x0); i < Math.ceil(x1); i++) this.setSolid(i, j, value);
  }

  /** Apply a localised force density (acceleration = f/ρ) and inject dye at (x, y) in cell units. */
  splat(x: number, y: number, fx: number, fy: number, radius: number, color: [number, number, number] | null, dt = 1) {
    const { nx, ny } = this;
    const r2 = radius * radius;
    const ext = Math.ceil(radius * 2.2);
    const W = nx + 1;
    const ax = (fx / this.rho) * dt;
    const ay = (fy / this.rho) * dt;
    for (let j = Math.max(0, Math.floor(y - ext)); j < Math.min(ny, y + ext); j++)
      for (let i = Math.max(0, Math.floor(x - ext)); i <= Math.min(nx, x + ext); i++) {
        // u-face at (i, j+½)
        const wu = Math.exp(-((i - x) ** 2 + (j + 0.5 - y) ** 2) / r2);
        if (wu > 0.01) this.u[j * W + i] += ax * wu;
      }
    for (let j = Math.max(0, Math.floor(y - ext)); j <= Math.min(ny, y + ext); j++)
      for (let i = Math.max(0, Math.floor(x - ext)); i < Math.min(nx, x + ext); i++) {
        const wv = Math.exp(-((i + 0.5 - x) ** 2 + (j - y) ** 2) / r2);
        if (wv > 0.01) this.v[j * nx + i] += ay * wv;
      }
    if (color)
      for (let j = Math.max(0, Math.floor(y - ext)); j < Math.min(ny, y + ext); j++)
        for (let i = Math.max(0, Math.floor(x - ext)); i < Math.min(nx, x + ext); i++) {
          const k = j * nx + i;
          if (this.solid[k]) continue;
          const w = Math.exp(-((i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2) / r2);
          if (w < 0.01) continue;
          this.dye[k * 3] = Math.min(4, this.dye[k * 3] + color[0] * w);
          this.dye[k * 3 + 1] = Math.min(4, this.dye[k * 3 + 1] + color[1] * w);
          this.dye[k * 3 + 2] = Math.min(4, this.dye[k * 3 + 2] + color[2] * w);
        }
    // prescribed faces are re-imposed at the start of every step()
  }

  /** Bilinear sample of an array of size w × h at fractional index coordinates (clamped). */
  private static sample(a: Float64Array, w: number, h: number, fx: number, fy: number, stride = 1, ch = 0): number {
    if (fx < 0) fx = 0;
    else if (fx > w - 1.0001) fx = w - 1.0001;
    if (fy < 0) fy = 0;
    else if (fy > h - 1.0001) fy = h - 1.0001;
    const i = fx | 0;
    const j = fy | 0;
    const s = fx - i;
    const t = fy - j;
    const k = j * w + i;
    return (
      (1 - t) * ((1 - s) * a[k * stride + ch] + s * a[(k + 1) * stride + ch]) +
      t * ((1 - s) * a[(k + w) * stride + ch] + s * a[(k + w + 1) * stride + ch])
    );
  }

  /** Horizontal velocity at a point (cell units). */
  uAt(x: number, y: number, u = this.u): number {
    return FluidSolver.sample(u, this.nx + 1, this.ny, x, y - 0.5);
  }
  /** Vertical velocity at a point (cell units). */
  vAt(x: number, y: number, v = this.v): number {
    return FluidSolver.sample(v, this.nx, this.ny + 1, x - 0.5, y);
  }

  /** Velocity at an arbitrary point (cell units). */
  velocityAt(x: number, y: number, u = this.u, v = this.v): [number, number] {
    return [FluidSolver.sample(u, this.nx + 1, this.ny, x, y - 0.5), FluidSolver.sample(v, this.nx, this.ny + 1, x - 0.5, y)];
  }

  private advectVelocity(dt: number) {
    const { nx, ny, u, v, u0, v0, uFixed, vFixed } = this;
    u0.set(u);
    v0.set(v);
    const W = nx + 1;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= nx; i++) {
        const k = j * W + i;
        if (uFixed[k]) continue;
        const x = i;
        const y = j + 0.5;
        // RK2 (midpoint) back-trace
        const vx = u0[k];
        const vy = this.vAt(x, y, v0);
        const hx = x - 0.5 * dt * vx;
        const hy = y - 0.5 * dt * vy;
        const mx = this.uAt(hx, hy, u0);
        const my = this.vAt(hx, hy, v0);
        u[k] = FluidSolver.sample(u0, W, ny, x - dt * mx, y - dt * my - 0.5);
      }
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (vFixed[k]) continue;
        const x = i + 0.5;
        const y = j;
        const vx = this.uAt(x, y, u0);
        const vy = v0[k];
        const hx = x - 0.5 * dt * vx;
        const hy = y - 0.5 * dt * vy;
        const mx = this.uAt(hx, hy, u0);
        const my = this.vAt(hx, hy, v0);
        v[k] = FluidSolver.sample(v0, nx, ny + 1, x - dt * mx - 0.5, y - dt * my);
      }
  }

  private advectDye(dt: number) {
    const { nx, ny, dye, dye0, solid, u, v } = this;
    const W = nx + 1;
    dye0.set(dye);
    const fade = this.dyeFade;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (solid[k]) continue;
        const x = i + 0.5;
        const y = j + 0.5;
        // centre velocity = average of the two faces in each direction
        const vx = 0.5 * (u[j * W + i] + u[j * W + i + 1]);
        const vy = 0.5 * (v[j * nx + i] + v[(j + 1) * nx + i]);
        const sx = x - dt * vx - 0.5;
        const sy = y - dt * vy - 0.5;
        dye[k * 3] = FluidSolver.sample(dye0, nx, ny, sx, sy, 3, 0) * fade;
        dye[k * 3 + 1] = FluidSolver.sample(dye0, nx, ny, sx, sy, 3, 1) * fade;
        dye[k * 3 + 2] = FluidSolver.sample(dye0, nx, ny, sx, sy, 3, 2) * fade;
      }
  }

  private diffuseVelocity(dt: number) {
    const a = dt * this.nu;
    if (a < 1e-5) return;
    const { nx, ny, u, v, uFixed, vFixed } = this;
    const W = nx + 1;
    this.u0.set(u);
    this.v0.set(v);
    const u0 = this.u0;
    const v0 = this.v0;
    const iters = 10;
    const c = 1 + 4 * a;
    for (let it = 0; it < iters; it++) {
      for (let j = 0; j < ny; j++)
        for (let i = 0; i <= nx; i++) {
          const k = j * W + i;
          if (uFixed[k]) continue;
          const l = i > 0 ? u[k - 1] : u[k];
          const r = i < nx ? u[k + 1] : u[k];
          const b = j > 0 ? u[k - W] : u[k];
          const t = j < ny - 1 ? u[k + W] : u[k];
          u[k] = (u0[k] + a * (l + r + b + t)) / c;
        }
      for (let j = 0; j <= ny; j++)
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (vFixed[k]) continue;
          const l = i > 0 ? v[k - 1] : v[k];
          const r = i < nx - 1 ? v[k + 1] : v[k];
          const b = j > 0 ? v[k - nx] : v[k];
          const t = j < ny ? v[k + nx] : v[k];
          v[k] = (v0[k] + a * (l + r + b + t)) / c;
        }
    }
  }

  /** Compute the discrete divergence of every fluid cell; returns the maximum |∇·u|. */
  computeDivergence(): number {
    const { nx, ny, u, v, div, solid } = this;
    const W = nx + 1;
    let m = 0;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (solid[k]) {
          div[k] = 0;
          continue;
        }
        const d = u[j * W + i + 1] - u[j * W + i] + v[(j + 1) * nx + i] - v[j * nx + i];
        div[k] = d;
        const ad = d < 0 ? -d : d;
        if (ad > m) m = ad;
      }
    return m;
  }

  private project() {
    const { nx, ny, u, v, p, div, solid, uFixed, vFixed } = this;
    const W = nx + 1;
    this.computeDivergence();
    const omega = this.omega;
    for (let it = 0; it < this.pressureIters; it++) {
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (solid[k]) continue;
          let sum = 0;
          let cnt = 0;
          if (!uFixed[j * W + i]) { sum += p[k - 1]; cnt++; }
          if (!uFixed[j * W + i + 1]) {
            if (i < nx - 1) sum += p[k + 1];
            // else: outflow face, Dirichlet p = 0 outside
            cnt++;
          }
          if (!vFixed[j * nx + i]) { sum += p[k - nx]; cnt++; }
          if (!vFixed[(j + 1) * nx + i]) { sum += p[k + nx]; cnt++; }
          if (cnt === 0) continue;
          const target = (sum - div[k]) / cnt;
          p[k] += omega * (target - p[k]);
        }
    }
    // subtract the pressure gradient on free faces
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= nx; i++) {
        const k = j * W + i;
        if (uFixed[k]) continue;
        const pr = i < nx ? p[j * nx + i] : 0;
        const pl = i > 0 ? p[j * nx + i - 1] : 0;
        u[k] -= pr - pl;
      }
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (vFixed[k]) continue;
        v[k] -= p[j * nx + i] - p[(j - 1) * nx + i];
      }
    this.maxDivergence = this.computeDivergence();
  }

  /** Vorticity ω = ∂v/∂x − ∂u/∂y at cell centres. */
  computeCurl() {
    const { nx, ny, curl } = this;
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const vr = this.vAt(i + 1.5, j + 0.5);
        const vl = this.vAt(i - 0.5, j + 0.5);
        const ut = this.uAt(i + 0.5, j + 1.5);
        const ub = this.uAt(i + 0.5, j - 0.5);
        curl[j * nx + i] = 0.5 * (vr - vl) - 0.5 * (ut - ub);
      }
  }

  private confine(dt: number) {
    if (this.vorticity <= 0) return;
    this.computeCurl();
    const { nx, ny, u, v, curl, solid } = this;
    const W = nx + 1;
    const eps = this.vorticity;
    for (let j = 2; j < ny - 2; j++)
      for (let i = 2; i < nx - 2; i++) {
        const k = j * nx + i;
        if (solid[k]) continue;
        const gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1]));
        const gy = 0.5 * (Math.abs(curl[k + nx]) - Math.abs(curl[k - nx]));
        const len = Math.hypot(gx, gy) + 1e-9;
        const w = curl[k];
        const fx = eps * (gy / len) * w * dt * 0.5;
        const fy = -eps * (gx / len) * w * dt * 0.5;
        u[j * W + i] += fx;
        u[j * W + i + 1] += fx;
        v[j * nx + i] += fy;
        v[(j + 1) * nx + i] += fy;
      }
  }

  step(dt = 1) {
    // advect → body forces & viscosity → project (Bridson ordering); dye rides the projected field
    this.enforceFixed();
    this.advectVelocity(dt);
    this.confine(dt);
    this.diffuseVelocity(dt);
    this.enforceFixed();
    this.project();
    this.advectDye(dt);
  }

  maxInteriorDivergence(): number {
    return this.computeDivergence();
  }

  /** Pressure in physical scaling: the solver's p is (Δt/ρ)·P, so P = ρ p / Δt. */
  pressureAt(k: number, dt = 1) {
    return (this.rho * this.p[k]) / dt;
  }
}
