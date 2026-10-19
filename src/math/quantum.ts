/**
 * One-dimensional time-independent Schrödinger equation  Ĥψ = Eψ,
 *   Ĥ = −(ħ²/2m) d²/dx² + V(x),
 * discretised with second-order central differences on a uniform grid with ψ = 0 at both ends
 * (infinitely high walls bounding the computational box). The resulting real symmetric
 * tridiagonal matrix is diagonalised by Sturm-sequence bisection + inverse iteration.
 *
 * Units: x in nanometres, energies in electron-volts, time in femtoseconds, particle = electron.
 */
export const HBAR2_2M = 0.0380998212; // ħ²/(2mₑ) in eV·nm²
export const HBAR_EV_FS = 0.6582119569; // ħ in eV·fs

export interface Grid1D {
  L: number;
  n: number; // interior points
  h: number;
  x: Float64Array; // interior coordinates
}

export function makeGrid(L: number, n: number): Grid1D {
  const h = L / (n + 1);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = (i + 1) * h;
  return { L, n, h, x };
}

/** Number of eigenvalues of the tridiagonal (d, e) strictly less than lambda. */
function sturmCount(d: Float64Array, e: number, lambda: number): number {
  let count = 0;
  let q = d[0] - lambda;
  if (q < 0) count++;
  const e2 = e * e;
  for (let i = 1; i < d.length; i++) {
    if (q === 0) q = 1e-300;
    q = d[i] - lambda - e2 / q;
    if (q < 0) count++;
  }
  return count;
}

/** Solve (T − μI) y = b for a symmetric tridiagonal T with constant off-diagonal e. */
function solveShifted(d: Float64Array, e: number, mu: number, b: Float64Array, out: Float64Array, cp: Float64Array) {
  const n = d.length;
  let m = d[0] - mu;
  if (Math.abs(m) < 1e-14) m = 1e-14;
  cp[0] = e / m;
  out[0] = b[0] / m;
  for (let i = 1; i < n; i++) {
    m = d[i] - mu - e * cp[i - 1];
    if (Math.abs(m) < 1e-14) m = 1e-14;
    cp[i] = e / m;
    out[i] = (b[i] - e * out[i - 1]) / m;
  }
  for (let i = n - 2; i >= 0; i--) out[i] -= cp[i] * out[i + 1];
}

export interface Eigenstates {
  energies: Float64Array; // eV
  states: Float64Array[]; // normalised so Σ ψ² h = 1 (units nm^{-1/2})
}

export function solveEigenstates(grid: Grid1D, V: Float64Array, count: number): Eigenstates {
  const { n, h } = grid;
  const t = HBAR2_2M / (h * h);
  const d = new Float64Array(n);
  let vmin = Infinity;
  let vmax = -Infinity;
  for (let i = 0; i < n; i++) {
    d[i] = 2 * t + V[i];
    vmin = Math.min(vmin, V[i]);
    vmax = Math.max(vmax, V[i]);
  }
  const e = -t;
  const lo0 = vmin; // all eigenvalues ≥ min V (kinetic operator is positive)
  const hi0 = vmax + 4 * t; // Gershgorin
  const k = Math.min(count, n);
  const energies = new Float64Array(k);
  for (let j = 0; j < k; j++) {
    let lo = j > 0 ? energies[j - 1] : lo0;
    let hi = hi0;
    for (let it = 0; it < 200 && hi - lo > 1e-13 * Math.max(1, Math.abs(hi)); it++) {
      const mid = 0.5 * (lo + hi);
      if (sturmCount(d, e, mid) > j) hi = mid;
      else lo = mid;
    }
    energies[j] = 0.5 * (lo + hi);
  }
  const states: Float64Array[] = [];
  const cp = new Float64Array(n);
  const tmp = new Float64Array(n);
  for (let j = 0; j < k; j++) {
    const lam = energies[j];
    const shift = lam + 1e-10 * Math.max(1, Math.abs(lam));
    let y = new Float64Array(n);
    // deterministic, non-symmetric start vector
    for (let i = 0; i < n; i++) y[i] = 1 + 0.37 * Math.sin(1.7 * i + j);
    for (let it = 0; it < 3; it++) {
      solveShifted(d, e, shift, y, tmp, cp);
      // re-orthogonalise against close neighbours (near-degenerate levels such as a double well)
      for (let p = Math.max(0, j - 6); p < j; p++) {
        if (Math.abs(energies[p] - lam) < 1e-4 * Math.max(1, Math.abs(lam))) {
          let dot = 0;
          const s = states[p];
          for (let i = 0; i < n; i++) dot += tmp[i] * s[i] * h;
          for (let i = 0; i < n; i++) tmp[i] -= dot * s[i];
        }
      }
      let norm = 0;
      for (let i = 0; i < n; i++) norm += tmp[i] * tmp[i];
      norm = Math.sqrt(norm * h);
      const ny = new Float64Array(n);
      for (let i = 0; i < n; i++) ny[i] = tmp[i] / norm;
      y = ny;
    }
    // sign convention: first lobe of significant size is positive
    let firstIdx = 0;
    let maxAbs = 0;
    for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(y[i]));
    for (let i = 0; i < n; i++) {
      if (Math.abs(y[i]) > 0.2 * maxAbs) {
        firstIdx = i;
        break;
      }
    }
    if (y[firstIdx] < 0) for (let i = 0; i < n; i++) y[i] = -y[i];
    states.push(y);
  }
  return { energies, states };
}

/** Count nodes (sign changes) in the interior of a state. */
export function countNodes(psi: Float64Array): number {
  let maxAbs = 0;
  for (let i = 0; i < psi.length; i++) maxAbs = Math.max(maxAbs, Math.abs(psi[i]));
  const thr = maxAbs * 1e-6;
  let last = 0;
  let nodes = 0;
  for (let i = 0; i < psi.length; i++) {
    const s = psi[i] > thr ? 1 : psi[i] < -thr ? -1 : 0;
    if (s !== 0) {
      if (last !== 0 && s !== last) nodes++;
      last = s;
    }
  }
  return nodes;
}

/** Analytic infinite-square-well energies E_n = n²π²ħ²/(2mL²). */
export const infiniteWellEnergy = (n: number, L: number) => (HBAR2_2M * (n * Math.PI) ** 2) / (L * L);

/** Project a complex initial state onto the real eigenbasis: c_n = Σ ψ_n(x) ψ₀(x) h. */
export function project(
  states: Float64Array[],
  re0: Float64Array,
  im0: Float64Array,
  h: number,
): { cr: Float64Array; ci: Float64Array; captured: number } {
  const m = states.length;
  const cr = new Float64Array(m);
  const ci = new Float64Array(m);
  let captured = 0;
  for (let k = 0; k < m; k++) {
    const s = states[k];
    let a = 0;
    let b = 0;
    for (let i = 0; i < s.length; i++) {
      a += s[i] * re0[i];
      b += s[i] * im0[i];
    }
    cr[k] = a * h;
    ci[k] = b * h;
    captured += cr[k] * cr[k] + ci[k] * ci[k];
  }
  return { cr, ci, captured };
}

/**
 * Exact time evolution in the (truncated) eigenbasis:
 *   ψ(x,t) = Σ c_n ψ_n(x) e^{−i E_n t/ħ}
 */
export function evolve(
  es: Eigenstates,
  cr: Float64Array,
  ci: Float64Array,
  tFs: number,
  outRe: Float64Array,
  outIm: Float64Array,
) {
  outRe.fill(0);
  outIm.fill(0);
  for (let k = 0; k < cr.length; k++) {
    if (cr[k] === 0 && ci[k] === 0) continue;
    const ph = (-es.energies[k] * tFs) / HBAR_EV_FS;
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    const ar = cr[k] * c - ci[k] * s;
    const ai = cr[k] * s + ci[k] * c;
    if (Math.abs(ar) + Math.abs(ai) < 1e-9) continue;
    const psi = es.states[k];
    for (let i = 0; i < psi.length; i++) {
      outRe[i] += ar * psi[i];
      outIm[i] += ai * psi[i];
    }
  }
}

/** Gaussian wave packet (normalised) with centre x0, width σ (nm) and wavenumber k0 (nm⁻¹). */
export function gaussianPacket(grid: Grid1D, x0: number, sigma: number, k0: number) {
  const re = new Float64Array(grid.n);
  const im = new Float64Array(grid.n);
  let norm = 0;
  for (let i = 0; i < grid.n; i++) {
    const dx = grid.x[i] - x0;
    const env = Math.exp(-(dx * dx) / (4 * sigma * sigma));
    re[i] = env * Math.cos(k0 * grid.x[i]);
    im[i] = env * Math.sin(k0 * grid.x[i]);
    norm += re[i] * re[i] + im[i] * im[i];
  }
  norm = Math.sqrt(norm * grid.h);
  for (let i = 0; i < grid.n; i++) {
    re[i] /= norm;
    im[i] /= norm;
  }
  return { re, im };
}
