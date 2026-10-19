/**
 * Normal distribution utilities.
 * erf uses the complementary error function algorithm from W. J. Cody (via Numerical Recipes
 * `erfcc` Chebyshev fit), giving fractional error < 1.2e-7 everywhere — ample for display.
 */

export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}
export const erf = (x: number) => 1 - erfc(x);

/** Probability density of N(μ, σ²). */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Cumulative distribution Φ((x − μ)/σ). */
export function normalCdf(x: number, mu = 0, sigma = 1): number {
  return 0.5 * erfc(-(x - mu) / (sigma * Math.SQRT2));
}

/** P(a ≤ X ≤ b) for X ~ N(μ, σ²). */
export function normalInterval(a: number, b: number, mu: number, sigma: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return normalCdf(hi, mu, sigma) - normalCdf(lo, mu, sigma);
}

export function mean(xs: ArrayLike<number>, n = xs.length): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += xs[i];
  return n ? s / n : NaN;
}
export function stddev(xs: ArrayLike<number>, n = xs.length): number {
  if (n < 2) return NaN;
  const m = mean(xs, n);
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - m) ** 2;
  return Math.sqrt(s / (n - 1));
}
