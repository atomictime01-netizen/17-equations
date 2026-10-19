/** Calculus helpers: function presets with exact derivatives/antiderivatives, plus numerics. */
export interface RealFn {
  id: string;
  label: string;
  tex: string;
  f: (x: number) => number;
  df?: (x: number) => number; // exact derivative when known
  F?: (x: number) => number; // exact antiderivative when known
  domain: [number, number];
  range: [number, number];
}

export const FUNCTIONS: RealFn[] = [
  {
    id: 'wave',
    label: 'Gentle wave',
    tex: 'f(x)=\\sin x + 0.3x',
    f: (x) => Math.sin(x) + 0.3 * x,
    df: (x) => Math.cos(x) + 0.3,
    F: (x) => -Math.cos(x) + 0.15 * x * x,
    domain: [-1, 7.5],
    range: [-1.6, 3.8],
  },
  {
    id: 'cubic',
    label: 'Cubic',
    tex: 'f(x)=\\tfrac{1}{4}x^3 - x',
    f: (x) => 0.25 * x ** 3 - x,
    df: (x) => 0.75 * x * x - 1,
    F: (x) => x ** 4 / 16 - x * x / 2,
    domain: [-3, 3],
    range: [-3.2, 3.2],
  },
  {
    id: 'parabola',
    label: 'Parabola',
    tex: 'f(x)=x^2',
    f: (x) => x * x,
    df: (x) => 2 * x,
    F: (x) => x ** 3 / 3,
    domain: [-2.5, 2.5],
    range: [-0.8, 6.5],
  },
  {
    id: 'gauss',
    label: 'Bell',
    tex: 'f(x)=2e^{-x^2/2}',
    f: (x) => 2 * Math.exp(-x * x / 2),
    df: (x) => -2 * x * Math.exp(-x * x / 2),
    domain: [-4, 4],
    range: [-0.5, 2.4],
  },
  {
    id: 'exp',
    label: 'Exponential',
    tex: 'f(x)=e^{x/2}',
    f: (x) => Math.exp(x / 2),
    df: (x) => 0.5 * Math.exp(x / 2),
    F: (x) => 2 * Math.exp(x / 2),
    domain: [-3, 4],
    range: [-0.5, 7.5],
  },
];

export const centralDiff = (f: (x: number) => number, x: number, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);

/** Composite Simpson's rule with n (even) panels. */
export function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

export type RiemannRule = 'left' | 'right' | 'midpoint' | 'trapezoid';

export function riemann(f: (x: number) => number, a: number, b: number, n: number, rule: RiemannRule): number {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h;
    if (rule === 'left') s += f(x0);
    else if (rule === 'right') s += f(x0 + h);
    else if (rule === 'midpoint') s += f(x0 + h / 2);
    else s += 0.5 * (f(x0) + f(x0 + h));
  }
  return s * h;
}

export function exactIntegral(fn: RealFn, a: number, b: number): number {
  return fn.F ? fn.F(b) - fn.F(a) : simpson(fn.f, a, b, 4000);
}

/**
 * Smooth function through user-drawn samples using a natural cubic spline.
 * xs must be strictly increasing.
 */
export function naturalSpline(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n < 2) return () => ys[0] ?? 0;
  const h = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = xs[i + 1] - xs[i];
  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  const l = new Array(n).fill(1);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const c = new Array(n).fill(0);
  const b = new Array(n - 1).fill(0);
  const d = new Array(n - 1).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return (x: number) => {
    let i = 0;
    if (x <= xs[0]) i = 0;
    else if (x >= xs[n - 1]) i = n - 2;
    else {
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (xs[m] > x) hi = m;
        else lo = m;
      }
      i = lo;
    }
    const dx = x - xs[i];
    return ys[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  };
}
