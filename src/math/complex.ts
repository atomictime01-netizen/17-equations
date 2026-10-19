/** Minimal complex arithmetic for the i² = −1 experience. */
export interface Complex {
  re: number;
  im: number;
}
export const cx = (re: number, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const abs = (a: Complex) => Math.hypot(a.re, a.im);
export const arg = (a: Complex) => Math.atan2(a.im, a.re);
export const expi = (theta: number): Complex => ({ re: Math.cos(theta), im: Math.sin(theta) });
export const fromPolar = (r: number, theta: number): Complex => ({ re: r * Math.cos(theta), im: r * Math.sin(theta) });
export const I = cx(0, 1);

/** Partial sums of the series e^{z} = Σ zⁿ/n!, returning every partial sum. */
export function expSeriesPartialSums(z: Complex, terms: number): Complex[] {
  const sums: Complex[] = [];
  let term = cx(1, 0);
  let sum = cx(0, 0);
  for (let n = 0; n < terms; n++) {
    sum = add(sum, term);
    sums.push(sum);
    term = mul(term, z);
    term = { re: term.re / (n + 1), im: term.im / (n + 1) };
  }
  return sums;
}

export function formatComplex(z: Complex, dp = 2): string {
  const re = Math.abs(z.re) < 0.5 * 10 ** -dp ? 0 : z.re;
  const im = Math.abs(z.im) < 0.5 * 10 ** -dp ? 0 : z.im;
  const r = re.toFixed(dp).replace('-', '−');
  const i = Math.abs(im).toFixed(dp);
  return `${r} ${im < 0 ? '−' : '+'} ${i}i`;
}
