import { describe, expect, it } from 'vitest';
import { amplitudeSpectrum, applyGain, dftNaive, fft, ifftReal, synthesize } from './fourier';
import { blackScholes, interpGrid, solveBSPDE } from './blackscholes';
import { attractorPeriod, logisticOrbit, lyapunov } from './logistic';
import { binaryEntropy, expectedCodeLength, huffman, shannonEntropy } from './information';
import { countNodes, HBAR2_2M, HBAR_EV_FS, infiniteWellEnergy, makeGrid, solveEigenstates, gaussianPacket, project, evolve } from './quantum';
import { normalCdf, normalInterval, normalPdf } from './stats';
import { eulerCharacteristic, pokeFace, splitEdge, splitFace, truncateVertex, SOLIDS, edgesOf } from './polyhedra';
import { FluidSolver } from './fluid';
import { Wave1D, Wave2D } from './wave';
import { G_SIM, relativeOrbit, twoBodyInit, verletStep, accel, forceSI, M_EARTH, M_SUN } from './gravity';
import { bField, C_LIGHT, circleCirculation, circleFlux, eField, EPS0, MU0, inducedE, Yee1D } from './em';
import { lnMultiplicity, maxLnMultiplicity, GasBox } from './thermo';
import { lnGamma, mulberry32, gaussianSampler } from './rng';
import { FUNCTIONS, exactIntegral, riemann, simpson, naturalSpline } from './calculus';
import { expSeriesPartialSums, mul, I, cx } from './complex';

describe('Fourier', () => {
  it('FFT matches the naive DFT', () => {
    const rand = mulberry32(1);
    const x = Array.from({ length: 64 }, () => rand() - 0.5);
    const a = fft(x);
    const b = dftNaive(x);
    for (let k = 0; k < 64; k++) {
      expect(a.re[k]).toBeCloseTo(b.re[k], 9);
      expect(a.im[k]).toBeCloseTo(b.im[k], 9);
    }
  });
  it('recovers amplitude and phase of pure tones', () => {
    const s = synthesize([{ freq: 5, amp: 0.8, phase: 0.3 }, { freq: 12, amp: 0.25, phase: -1 }], 256);
    const { amp, phase } = amplitudeSpectrum(fft(s));
    expect(amp[5]).toBeCloseTo(0.8, 9);
    expect(phase[5]).toBeCloseTo(0.3, 9);
    expect(amp[12]).toBeCloseTo(0.25, 9);
    expect(amp[7]).toBeLessThan(1e-9);
  });
  it('inverse FFT round-trips and filtering removes a tone', () => {
    const s = synthesize([{ freq: 3, amp: 1, phase: 0 }, { freq: 40, amp: 0.5, phase: 0 }], 256);
    const back = ifftReal(fft(s));
    for (let i = 0; i < 256; i++) expect(back[i]).toBeCloseTo(s[i], 9);
    const low = ifftReal(applyGain(fft(s), (k) => (k < 10 ? 1 : 0)));
    const pure = synthesize([{ freq: 3, amp: 1, phase: 0 }], 256);
    for (let i = 0; i < 256; i++) expect(low[i]).toBeCloseTo(pure[i], 9);
  });
  it("satisfies Parseval's theorem", () => {
    const rand = mulberry32(7);
    const x = Array.from({ length: 128 }, () => rand());
    const X = fft(x);
    const et = x.reduce((s, v) => s + v * v, 0);
    let ef = 0;
    for (let k = 0; k < 128; k++) ef += X.re[k] ** 2 + X.im[k] ** 2;
    expect(ef / 128).toBeCloseTo(et, 8);
  });
});

describe('Black–Scholes', () => {
  const p = { S: 100, K: 100, T: 1, sigma: 0.2, r: 0.05 };
  it('matches textbook prices', () => {
    expect(blackScholes('call', p).price).toBeCloseTo(10.4506, 3);
    expect(blackScholes('put', p).price).toBeCloseTo(5.5735, 3);
    expect(blackScholes('call', p).delta).toBeCloseTo(0.6368, 3);
  });
  it('satisfies put–call parity', () => {
    const q = { S: 87, K: 95, T: 0.7, sigma: 0.35, r: 0.03 };
    const c = blackScholes('call', q).price;
    const pp = blackScholes('put', q).price;
    expect(c - pp).toBeCloseTo(q.S - q.K * Math.exp(-q.r * q.T), 5);
  });
  it('Crank–Nicolson PDE solution agrees with the closed form', () => {
    for (const kind of ['call', 'put'] as const) {
      const { S, V } = solveBSPDE(kind, { K: 100, T: 1, sigma: 0.2, r: 0.05 }, { nS: 400, nT: 400 });
      for (const s of [80, 100, 120]) {
        expect(Math.abs(interpGrid(S, V, s) - blackScholes(kind, { ...p, S: s }).price)).toBeLessThan(0.02);
      }
    }
  });
});

describe('Logistic map', () => {
  it('converges to the fixed point 1 − 1/r for 1 < r < 3', () => {
    const o = logisticOrbit(2.5, 0.2, 500);
    expect(o[500]).toBeCloseTo(1 - 1 / 2.5, 10);
  });
  it('shows period doubling and the period-3 window', () => {
    expect(attractorPeriod(2.8)).toBe(1);
    expect(attractorPeriod(3.2)).toBe(2);
    expect(attractorPeriod(3.5)).toBe(4);
    expect(attractorPeriod(3.55)).toBe(8);
    expect(attractorPeriod(3.835)).toBe(3);
  });
  it('Lyapunov exponent: negative when periodic, ln 2 at r = 4', () => {
    expect(lyapunov(3.2)).toBeLessThan(0);
    expect(lyapunov(4, 0.2, 100, 200000)).toBeCloseTo(Math.LN2, 1);
  });
});

describe('Shannon entropy & Huffman coding', () => {
  it('computes entropy in bits', () => {
    expect(shannonEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2, 12);
    expect(shannonEntropy([1, 0, 0])).toBe(0);
    expect(binaryEntropy(0.5)).toBeCloseTo(1, 12);
    expect(binaryEntropy(0.11)).toBeCloseTo(0.4999, 3);
  });
  it('Huffman is optimal for dyadic distributions and within 1 bit otherwise', () => {
    const p = [0.5, 0.25, 0.125, 0.125];
    const { codes } = huffman(p);
    expect(expectedCodeLength(p, codes)).toBeCloseTo(shannonEntropy(p), 12);
    const q = [0.4, 0.3, 0.2, 0.1];
    const L = expectedCodeLength(q, huffman(q).codes);
    expect(L).toBeGreaterThanOrEqual(shannonEntropy(q));
    expect(L).toBeLessThan(shannonEntropy(q) + 1);
    // prefix-free
    const cs = huffman(q).codes as string[];
    for (const a of cs) for (const b of cs) if (a !== b) expect(b.startsWith(a)).toBe(false);
  });
});

describe('Schrödinger eigenstates', () => {
  it('infinite square well energies and node counts', () => {
    const L = 2;
    const grid = makeGrid(L, 600);
    const V = new Float64Array(grid.n);
    const es = solveEigenstates(grid, V, 5);
    for (let n = 1; n <= 5; n++) {
      expect(Math.abs(es.energies[n - 1] / infiniteWellEnergy(n, L) - 1)).toBeLessThan(2e-3);
      expect(countNodes(es.states[n - 1])).toBe(n - 1);
    }
  });
  it('harmonic oscillator energies ħω(n + ½)', () => {
    const L = 8;
    const grid = makeGrid(L, 800);
    const omegaE = 0.5; // ħω in eV
    // V = ½ m ω² x² = (ħω)² x² / (4 · ħ²/2m)
    const V = grid.x.map((x) => (omegaE * omegaE * (x - L / 2) ** 2) / (4 * HBAR2_2M));
    const es = solveEigenstates(grid, Float64Array.from(V), 4);
    for (let n = 0; n < 4; n++) expect(es.energies[n]).toBeCloseTo(omegaE * (n + 0.5), 2);
  });
  it('eigenstates are orthonormal and evolution preserves the norm', () => {
    const grid = makeGrid(4, 300);
    const V = grid.x.map((x) => (Math.abs(x - 2) < 0.2 ? 2 : 0));
    const es = solveEigenstates(grid, Float64Array.from(V), 60);
    let dot01 = 0;
    let n0 = 0;
    for (let i = 0; i < grid.n; i++) {
      dot01 += es.states[0][i] * es.states[1][i] * grid.h;
      n0 += es.states[0][i] ** 2 * grid.h;
    }
    expect(n0).toBeCloseTo(1, 8);
    expect(Math.abs(dot01)).toBeLessThan(1e-6);
    const pk = gaussianPacket(grid, 1, 0.25, 8);
    const { cr, ci, captured } = project(es.states, pk.re, pk.im, grid.h);
    expect(captured).toBeGreaterThan(0.99);
    const re = new Float64Array(grid.n);
    const im = new Float64Array(grid.n);
    evolve(es, cr, ci, 3.7, re, im);
    let norm = 0;
    for (let i = 0; i < grid.n; i++) norm += (re[i] ** 2 + im[i] ** 2) * grid.h;
    expect(norm).toBeCloseTo(captured, 6);
    expect(HBAR_EV_FS).toBeCloseTo(0.6582, 4);
  });
});

describe('Normal distribution', () => {
  it('68–95–99.7 rule and density', () => {
    expect(normalInterval(-1, 1, 0, 1)).toBeCloseTo(0.682689, 5);
    expect(normalInterval(-2, 2, 0, 1)).toBeCloseTo(0.954500, 5);
    expect(normalInterval(-3, 3, 0, 1)).toBeCloseTo(0.997300, 5);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12);
  });
  it('Box–Muller samples have the right moments', () => {
    const g = gaussianSampler(mulberry32(42));
    let s = 0;
    let s2 = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const v = g();
      s += v;
      s2 += v * v;
    }
    expect(s / N).toBeCloseTo(0, 1);
    expect(s2 / N).toBeCloseTo(1, 1);
  });
});

describe('Euler characteristic', () => {
  it('V − E + F = 2 for convex solids', () => {
    const expected: Record<string, [number, number, number]> = {
      tetrahedron: [4, 6, 4],
      cube: [8, 12, 6],
      octahedron: [6, 12, 8],
      dodecahedron: [20, 30, 12],
      icosahedron: [12, 30, 20],
    };
    for (const [k, make] of Object.entries(SOLIDS)) {
      const c = eulerCharacteristic(make());
      if (k === 'torus') expect(c.chi).toBe(0);
      else expect(c.chi).toBe(2);
      if (expected[k]) expect([c.V, c.E, c.F]).toEqual(expected[k]);
    }
  });
  it('local surgeries preserve χ', () => {
    let p = SOLIDS.cube();
    p = pokeFace(p, 0);
    expect(eulerCharacteristic(p).chi).toBe(2);
    const [a, b] = edgesOf(p.faces)[0];
    p = splitEdge(p, a, b);
    expect(eulerCharacteristic(p).chi).toBe(2);
    p = splitFace(p, p.faces.findIndex((f) => f.length >= 4))!;
    expect(eulerCharacteristic(p).chi).toBe(2);
    p = truncateVertex(p, 1);
    const c = eulerCharacteristic(p);
    expect(c.chi).toBe(2);
    // every edge belongs to exactly two faces (closed surface)
    const counts = new Map<string, number>();
    for (const f of p.faces)
      for (let i = 0; i < f.length; i++) {
        const x = f[i];
        const y = f[(i + 1) % f.length];
        const key = x < y ? `${x},${y}` : `${y},${x}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    for (const v of counts.values()) expect(v).toBe(2);
  });
});

describe('Fluid solver', () => {
  it('projection leaves an (approximately) divergence-free field', () => {
    const f = new FluidSolver(64, 48);
    f.mode = 'tank';
    f.reset();
    f.addCircleObstacle(32, 24, 5);
    for (let s = 0; s < 20; s++) {
      f.splat(15, 24, 3, 0.5, 4, [1, 0, 0]);
      f.step(1);
    }
    expect(Number.isFinite(f.u[24 * 65 + 40])).toBe(true);
    let maxSpeed = 0;
    for (let k = 0; k < f.u.length; k++) maxSpeed = Math.max(maxSpeed, Math.abs(f.u[k]));
    // MAC-grid projection: residual divergence is limited only by the SOR iterations
    expect(f.maxInteriorDivergence() / maxSpeed).toBeLessThan(0.01);
    // obstacle cells stay at rest
    expect(f.u[24 * 65 + 32]).toBe(0);
  });
  it('tunnel flow stays bounded', () => {
    const f = new FluidSolver(96, 48);
    f.mode = 'tunnel';
    f.addCircleObstacle(24, 24, 5);
    f.reset();
    for (let s = 0; s < 100; s++) f.step(1);
    let maxSpeed = 0;
    for (let k = 0; k < f.u.length; k++) maxSpeed = Math.max(maxSpeed, Math.abs(f.u[k]));
    expect(maxSpeed).toBeLessThan(5 * f.inflow);
  });
});

describe('Wave equation', () => {
  it('1-D standing harmonic keeps its shape and the leapfrog scheme is stable', () => {
    const w = new Wave1D(201);
    w.c = 1;
    w.harmonic(2, 1);
    let maxAbs = 0;
    for (let s = 0; s < 2000; s++) {
      w.step();
      for (const v of w.u) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    expect(maxAbs).toBeLessThan(1.05);
  });
  it('2-D membrane energy is conserved without damping', () => {
    const w = new Wave2D(64);
    w.c = 1;
    w.pulse(32, 32, 1, 3);
    w.step();
    const e0 = w.energy();
    for (let s = 0; s < 300; s++) w.step();
    expect(Math.abs(w.energy() / e0 - 1)).toBeLessThan(0.05);
  });
});

describe('Gravity', () => {
  it('Earth–Sun force and one-year orbit', () => {
    expect(forceSI(1, M_EARTH / M_SUN, 1)).toBeGreaterThan(3.5e22);
    expect(forceSI(1, M_EARTH / M_SUN, 1)).toBeLessThan(3.6e22);
    const bodies = twoBodyInit(1, 3e-6, 1, 1);
    const ax = new Float64Array(2);
    const ay = new Float64Array(2);
    accel(bodies, 2, 0, ax, ay);
    const orb = relativeOrbit(bodies);
    expect(orb.period).toBeCloseTo(1, 4);
    expect(orb.e).toBeLessThan(1e-9);
    const dt = 1 / 2000;
    for (let i = 0; i < 2000; i++) verletStep(bodies, dt, 2, 0, ax, ay);
    // back to start after one year
    expect(bodies[1].x).toBeCloseTo(1, 3);
    expect(Math.abs(bodies[1].y)).toBeLessThan(2e-3);
    expect(G_SIM).toBeCloseTo(39.478, 3);
  });
});

describe('Electromagnetism', () => {
  it("Gauss's and Ampère's laws hold for the 2-D field models", () => {
    const charges = [{ x: 0, y: 0, q: 2 }, { x: 0.3, y: 0.1, q: -1 }, { x: 2, y: 0, q: 5 }];
    const flux = circleFlux((x, y) => eField(charges, x, y), 0.1, 0, 0.8);
    expect(flux / ((1e-9 * (2 - 1)) / EPS0)).toBeCloseTo(1, 3);
    const wires = [{ x: 0, y: 0, I: 3 }, { x: 5, y: 0, I: -2 }];
    const circ = circleCirculation((x, y) => bField(wires, x, y), 0, 0, 1);
    expect(circ / (MU0 * 3)).toBeCloseTo(1, 3);
    const bflux = circleFlux((x, y) => bField(wires, x, y), 0.2, 0.1, 1);
    expect(Math.abs(bflux)).toBeLessThan(1e-12);
    expect(1 / Math.sqrt(MU0 * EPS0)).toBeCloseTo(C_LIGHT, -2);
  });
  it('Faraday: induced EMF equals −dΦ/dt', () => {
    const a = 0.1;
    const dBdt = 2;
    const R = 0.3;
    const emf = 2 * Math.PI * R * inducedE(R, a, dBdt);
    expect(emf).toBeCloseTo(-Math.PI * a * a * dBdt, 10);
  });
  it('Yee FDTD pulse travels at c (one cell per step at S = 1)', () => {
    const y = new Yee1D(400);
    for (let t = 0; t < 200; t++) y.step(t < 30 ? Math.exp(-(((t - 15) / 5) ** 2)) : 0, 50);
    let imax = 0;
    for (let i = 60; i < 400; i++) if (Math.abs(y.E[i]) > Math.abs(y.E[imax])) imax = i;
    // pulse peak emitted at t≈15 from x=50 → at t=200 near x = 50 + 185
    expect(Math.abs(imax - 235)).toBeLessThan(4);
  });
});

describe('Thermodynamics', () => {
  it('multiplicity counts', () => {
    expect(Math.exp(lnMultiplicity([2, 2]))).toBeCloseTo(6, 8);
    expect(lnMultiplicity([10, 0])).toBeCloseTo(0, 10);
    expect(maxLnMultiplicity(4, 2)).toBeCloseTo(Math.log(6), 10);
    expect(lnGamma(11)).toBeCloseTo(Math.log(3628800), 9);
  });
  it('gas conserves kinetic energy and entropy rises after the partition opens', () => {
    const g = new GasBox();
    g.init(400, { leftFraction: 1, speed: 0.3, twoSpecies: false, seed: mulberry32(3) });
    const e0 = g.kineticEnergy();
    const s0 = lnMultiplicity(g.occupancy(2, 1));
    g.partition = false;
    for (let i = 0; i < 1500; i++) g.step(0.004);
    expect(g.kineticEnergy()).toBeCloseTo(e0, 6);
    expect(lnMultiplicity(g.occupancy(2, 1))).toBeGreaterThan(s0 + 200);
  });
});

describe('Calculus', () => {
  it('Riemann sums converge to the exact integral', () => {
    const fn = FUNCTIONS.find((f) => f.id === 'parabola')!;
    const exact = exactIntegral(fn, 0, 2);
    expect(exact).toBeCloseTo(8 / 3, 12);
    expect(Math.abs(riemann(fn.f, 0, 2, 1000, 'left') - exact)).toBeLessThan(0.005);
    expect(Math.abs(riemann(fn.f, 0, 2, 1000, 'midpoint') - exact)).toBeLessThan(1e-5);
    expect(simpson(Math.sin, 0, Math.PI)).toBeCloseTo(2, 10);
  });
  it('spline interpolates its knots', () => {
    const s = naturalSpline([0, 1, 2, 3], [0, 1, 0, 1]);
    expect(s(1)).toBeCloseTo(1, 12);
    expect(s(2)).toBeCloseTo(0, 12);
  });
});

describe('Complex numbers', () => {
  it('i² = −1 and the series for e^{iπ} tends to −1', () => {
    const i2 = mul(I, I);
    expect(i2.re).toBe(-1);
    expect(i2.im).toBe(0);
    const sums = expSeriesPartialSums(cx(0, Math.PI), 30);
    expect(sums[29].re).toBeCloseTo(-1, 10);
    expect(sums[29].im).toBeCloseTo(0, 10);
  });
});
