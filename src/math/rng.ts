/** Small, fast, seedable PRNG (mulberry32). Deterministic demos depend on it. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sampler using the Box–Muller transform. */
export function gaussianSampler(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u <= Number.EPSILON) u = rand();
    const v = rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const easeInOutCubic = (t: number) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** ln Γ(x) via Lanczos approximation (g = 7, n = 9). Accurate to ~1e-15 for x > 0. */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
export const lnFactorial = (n: number) => lnGamma(n + 1);

/** Format a number in scientific notation with Unicode superscripts: 3.54 × 10²² */
const SUP: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
export function sci(x: number, digits = 3): string {
  if (!isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e-3 && ax < 1e5) return fmt(x, digits);
  const e = Math.floor(Math.log10(ax));
  let m = x / Math.pow(10, e);
  let ee = e;
  if (Math.abs(Number(m.toFixed(digits - 1))) >= 10) {
    m /= 10;
    ee += 1;
  }
  const ms = m.toFixed(digits - 1).replace('-', '−');
  const es = String(ee).split('').map((c) => SUP[c] ?? c).join('');
  return `${ms} × 10${es}`;
}
/** n significant figures, switching to scientific notation for very large/small magnitudes. */
export function fmt(x: number, digits = 3): string {
  if (!isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  const ax = Math.abs(x);
  if (ax !== 0 && (ax < 1e-3 || ax >= 1e6)) return sci(x, digits);
  return String(Number(x.toPrecision(digits))).replace('-', '−');
}
/** Fixed decimal places with a typographic minus sign. */
export function fix(x: number, dp = 2): string {
  if (!isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  const s = x.toFixed(dp);
  return (/^-0\.?0*$/.test(s) ? s.slice(1) : s).replace('-', '−');
}
