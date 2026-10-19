/**
 * Discrete Fourier analysis.
 * The interactive uses the DFT  X[k] = Σ x[n] e^{-2πikn/N}  computed with an iterative
 * radix-2 Cooley–Tukey FFT. This is the sampled, finite-length counterpart of the continuous
 * transform F(ω) = ∫ f(t) e^{-iωt} dt.
 */

export function isPowerOfTwo(n: number) {
  return n > 0 && (n & (n - 1)) === 0;
}

/** In-place complex FFT. `inverse` computes the unnormalised inverse (caller divides by N). */
export function fftInPlace(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (!isPowerOfTwo(n) || im.length !== n) throw new Error('FFT length must be a power of two');
  // bit reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k + half];
        const ai = im[i + k + half];
        const tr = ar * cr - ai * ci;
        const ti = ar * ci + ai * cr;
        re[i + k + half] = re[i + k] - tr;
        im[i + k + half] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface Spectrum {
  re: Float64Array;
  im: Float64Array;
}

export function fft(signal: ArrayLike<number>): Spectrum {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = signal[i];
  fftInPlace(re, im);
  return { re, im };
}

/** Inverse FFT returning the real part (input assumed Hermitian-symmetric for real signals). */
export function ifftReal(spec: Spectrum): Float64Array {
  const n = spec.re.length;
  const re = Float64Array.from(spec.re);
  const im = Float64Array.from(spec.im);
  fftInPlace(re, im, true);
  for (let i = 0; i < n; i++) re[i] /= n;
  return re;
}

/** Naive O(N²) DFT used to validate the FFT. */
export function dftNaive(signal: ArrayLike<number>): Spectrum {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * k * t) / n;
      sr += signal[t] * Math.cos(a);
      si += signal[t] * Math.sin(a);
    }
    re[k] = sr;
    im[k] = si;
  }
  return { re, im };
}

/**
 * One-sided amplitude spectrum of a real signal: for a pure tone A·cos(2πkt/N + φ),
 * amplitude[k] = A and phase[k] = φ.
 */
export function amplitudeSpectrum(spec: Spectrum): { amp: Float64Array; phase: Float64Array } {
  const n = spec.re.length;
  const half = n / 2;
  const amp = new Float64Array(half + 1);
  const phase = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    const m = Math.hypot(spec.re[k], spec.im[k]);
    amp[k] = k === 0 || k === half ? m / n : (2 * m) / n;
    phase[k] = Math.atan2(spec.im[k], spec.re[k]);
  }
  return { amp, phase };
}

/** Zero out (or scale) bins of a real-signal spectrum symmetrically according to a gain per bin 0..N/2. */
export function applyGain(spec: Spectrum, gain: (k: number) => number): Spectrum {
  const n = spec.re.length;
  const re = Float64Array.from(spec.re);
  const im = Float64Array.from(spec.im);
  for (let k = 0; k <= n / 2; k++) {
    const g = gain(k);
    re[k] *= g;
    im[k] *= g;
    if (k > 0 && k < n / 2) {
      re[n - k] *= g;
      im[n - k] *= g;
    }
  }
  return { re, im };
}

export interface Sinusoid {
  freq: number; // cycles per window
  amp: number;
  phase: number; // radians
}

/** Synthesise N samples of Σ A cos(2π f t/N + φ) over one window. */
export function synthesize(components: Sinusoid[], n: number): Float64Array {
  const out = new Float64Array(n);
  for (const c of components) {
    for (let t = 0; t < n; t++) out[t] += c.amp * Math.cos((2 * Math.PI * c.freq * t) / n + c.phase);
  }
  return out;
}
