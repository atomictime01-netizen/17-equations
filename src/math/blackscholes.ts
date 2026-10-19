import { normalCdf, normalPdf } from './stats';

export type OptionKind = 'call' | 'put';

export interface BSParams {
  S: number; // underlying price
  K: number; // strike
  T: number; // time to expiry in years
  sigma: number; // annualised volatility
  r: number; // continuously-compounded risk-free rate
}

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  vega: number; // per 1.00 change in σ
  theta: number; // per year
  rho: number; // per 1.00 change in r
  d1: number;
  d2: number;
}

export function intrinsic(kind: OptionKind, S: number, K: number) {
  return kind === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

/** Closed-form Black–Scholes price and Greeks for a European option (no dividends). */
export function blackScholes(kind: OptionKind, p: BSParams): BSResult {
  const { S, K, T, sigma, r } = p;
  if (T <= 1e-10 || sigma <= 1e-10) {
    // At expiry (or zero volatility) the value is the discounted deterministic payoff.
    const fwd = S - K * Math.exp(-r * Math.max(T, 0));
    const price = kind === 'call' ? Math.max(fwd, 0) : Math.max(-fwd, 0);
    const itm = kind === 'call' ? fwd > 0 : fwd < 0;
    return { price, delta: itm ? (kind === 'call' ? 1 : -1) : 0, gamma: 0, vega: 0, theta: 0, rho: 0, d1: NaN, d2: NaN };
  }
  const sq = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sq);
  const d2 = d1 - sigma * sq;
  const disc = Math.exp(-r * T);
  const pdf1 = normalPdf(d1);
  const gamma = pdf1 / (S * sigma * sq);
  const vega = S * pdf1 * sq;
  if (kind === 'call') {
    const price = S * normalCdf(d1) - K * disc * normalCdf(d2);
    return {
      price,
      delta: normalCdf(d1),
      gamma,
      vega,
      theta: (-S * pdf1 * sigma) / (2 * sq) - r * K * disc * normalCdf(d2),
      rho: K * T * disc * normalCdf(d2),
      d1,
      d2,
    };
  }
  const price = K * disc * normalCdf(-d2) - S * normalCdf(-d1);
  return {
    price,
    delta: normalCdf(d1) - 1,
    gamma,
    vega,
    theta: (-S * pdf1 * sigma) / (2 * sq) + r * K * disc * normalCdf(-d2),
    rho: -K * T * disc * normalCdf(-d2),
    d1,
    d2,
  };
}

/**
 * Numerical solution of the Black–Scholes PDE
 *   ∂V/∂t + ½σ²S² ∂²V/∂S² + rS ∂V/∂S − rV = 0
 * with the Crank–Nicolson scheme on a uniform S-grid [0, Smax], marching backward from the
 * payoff at expiry. Rannacher start-up (two implicit half-steps) damps the payoff kink.
 * Returns the grid and the value at each node at t = 0 (i.e. time-to-expiry T).
 */
export function solveBSPDE(
  kind: OptionKind,
  p: Omit<BSParams, 'S'>,
  opts: { nS?: number; nT?: number; sMaxFactor?: number } = {},
): { S: Float64Array; V: Float64Array } {
  const { K, T, sigma, r } = p;
  const nS = opts.nS ?? 200;
  const nT = Math.max(opts.nT ?? 200, 4);
  const Smax = (opts.sMaxFactor ?? 4) * K;
  const dS = Smax / nS;
  const S = new Float64Array(nS + 1);
  const V = new Float64Array(nS + 1);
  for (let i = 0; i <= nS; i++) {
    S[i] = i * dS;
    V[i] = intrinsic(kind, S[i], K);
  }
  if (T <= 0) return { S, V };
  const dt = T / nT;

  // Coefficients of the spatial operator L V_i = a_i V_{i-1} + b_i V_i + c_i V_{i+1}
  const a = new Float64Array(nS + 1);
  const b = new Float64Array(nS + 1);
  const c = new Float64Array(nS + 1);
  for (let i = 1; i < nS; i++) {
    const s2 = sigma * sigma * i * i;
    a[i] = 0.5 * (s2 - r * i);
    b[i] = -s2 - r;
    c[i] = 0.5 * (s2 + r * i);
  }
  const lower = new Float64Array(nS + 1);
  const diag = new Float64Array(nS + 1);
  const upper = new Float64Array(nS + 1);
  const rhs = new Float64Array(nS + 1);
  const cp = new Float64Array(nS + 1);
  const dp = new Float64Array(nS + 1);

  const step = (theta: number, h: number, tau: number) => {
    // (I − θhL) V^{new} = (I + (1−θ)hL) V^{old}; tau = time-to-expiry after the step
    for (let i = 1; i < nS; i++) {
      rhs[i] = V[i] + (1 - theta) * h * (a[i] * V[i - 1] + b[i] * V[i] + c[i] * V[i + 1]);
      lower[i] = -theta * h * a[i];
      diag[i] = 1 - theta * h * b[i];
      upper[i] = -theta * h * c[i];
    }
    // Dirichlet boundaries
    const v0 = kind === 'call' ? 0 : K * Math.exp(-r * tau);
    const vN = kind === 'call' ? Smax - K * Math.exp(-r * tau) : 0;
    rhs[1] -= lower[1] * v0;
    rhs[nS - 1] -= upper[nS - 1] * vN;
    // Thomas algorithm on indices 1..nS-1
    cp[1] = upper[1] / diag[1];
    dp[1] = rhs[1] / diag[1];
    for (let i = 2; i < nS; i++) {
      const m = diag[i] - lower[i] * cp[i - 1];
      cp[i] = upper[i] / m;
      dp[i] = (rhs[i] - lower[i] * dp[i - 1]) / m;
    }
    V[nS - 1] = dp[nS - 1];
    for (let i = nS - 2; i >= 1; i--) V[i] = dp[i] - cp[i] * V[i + 1];
    V[0] = v0;
    V[nS] = vN;
  };

  let tau = 0;
  // Rannacher smoothing: 4 fully implicit quarter steps replace the first 2 CN steps
  for (let k = 0; k < 4; k++) {
    tau += dt / 2;
    step(1, dt / 2, tau);
  }
  for (let n = 2; n < nT; n++) {
    tau += dt;
    step(0.5, dt, tau);
  }
  return { S, V };
}

/** Linear interpolation of a grid solution at price s. */
export function interpGrid(S: Float64Array, V: Float64Array, s: number): number {
  const n = S.length - 1;
  const dS = S[1] - S[0];
  const x = s / dS;
  if (x <= 0) return V[0];
  if (x >= n) return V[n];
  const i = Math.floor(x);
  const f = x - i;
  return V[i] * (1 - f) + V[i + 1] * f;
}
