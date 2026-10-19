/** The logistic map x_{n+1} = r x_n (1 − x_n). */
export const logisticStep = (r: number, x: number) => r * x * (1 - x);

export function logisticOrbit(r: number, x0: number, n: number): Float64Array {
  const out = new Float64Array(n + 1);
  out[0] = x0;
  for (let i = 0; i < n; i++) out[i + 1] = logisticStep(r, out[i]);
  return out;
}

/**
 * Lyapunov exponent λ = lim (1/N) Σ ln|r(1 − 2x_n)|.
 * λ < 0: nearby orbits converge (stable/periodic); λ > 0: sensitive dependence (chaos).
 */
export function lyapunov(r: number, x0 = 0.4, transient = 500, n = 2000): number {
  let x = x0;
  for (let i = 0; i < transient; i++) x = logisticStep(r, x);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(r * (1 - 2 * x));
    sum += Math.log(Math.max(d, 1e-300));
    x = logisticStep(r, x);
  }
  return sum / n;
}

/** Detect the period of the attractor (1..maxPeriod) or 0 if none found (chaotic / quasi). */
export function attractorPeriod(r: number, x0 = 0.4, transient = 4000, maxPeriod = 64, tol = 1e-6): number {
  let x = x0;
  for (let i = 0; i < transient; i++) x = logisticStep(r, x);
  const orbit = [x];
  for (let i = 0; i < maxPeriod; i++) {
    x = logisticStep(r, x);
    orbit.push(x);
  }
  for (let p = 1; p <= maxPeriod; p++) {
    if (Math.abs(orbit[p] - orbit[0]) < tol) {
      // confirm one more cycle
      let y = orbit[p];
      for (let i = 0; i < p; i++) y = logisticStep(r, y);
      if (Math.abs(y - orbit[0]) < tol * 4) return p;
    }
  }
  return 0;
}

export interface BifurcationRequest {
  width: number;
  height: number;
  rMin: number;
  rMax: number;
  xMin: number;
  xMax: number;
  transient: number;
  samples: number;
}

/**
 * Build a bifurcation density image: for each column's r, iterate past a transient and
 * accumulate hits of the subsequent iterates into the pixel rows. Returns counts per pixel.
 */
export function bifurcationDensity(req: BifurcationRequest): Float32Array {
  const { width, height, rMin, rMax, xMin, xMax, transient, samples } = req;
  const out = new Float32Array(width * height);
  const sub = 2; // sub-column supersampling
  for (let col = 0; col < width; col++) {
    for (let s = 0; s < sub; s++) {
      const r = rMin + ((col + (s + 0.5) / sub) / width) * (rMax - rMin);
      let x = 0.5 + 0.01 * s;
      for (let i = 0; i < transient; i++) x = r * x * (1 - x);
      for (let i = 0; i < samples; i++) {
        x = r * x * (1 - x);
        const row = Math.floor(((xMax - x) / (xMax - xMin)) * height);
        if (row >= 0 && row < height) out[row * width + col] += 1;
      }
    }
  }
  return out;
}

/** Known landmarks along r for annotation and threshold feedback. */
export const LOGISTIC_LANDMARKS = [
  { r: 1, label: 'r = 1 — population can persist' },
  { r: 3, label: 'r = 3 — first period-doubling' },
  { r: 1 + Math.sqrt(6), label: 'r ≈ 3.449 — period 4' },
  { r: 3.5440903, label: 'r ≈ 3.544 — period 8' },
  { r: 3.5699456, label: 'r ≈ 3.5699 — accumulation point: onset of chaos' },
  { r: 1 + Math.sqrt(8), label: 'r ≈ 3.8284 — period-3 window opens' },
];
