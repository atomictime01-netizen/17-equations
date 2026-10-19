/**
 * Newtonian two-body gravity.
 * Simulation units: astronomical units (AU), years, solar masses (M☉). In these units
 * G = 4π² AU³ M☉⁻¹ yr⁻², so Earth at 1 AU orbits the Sun at 2π AU/yr with a 1-year period.
 * The force law exponent p can be changed (F ∝ 1/r^p) to compare with the real inverse square.
 */
export const G_SI = 6.6743e-11; // m³ kg⁻¹ s⁻²
export const M_SUN = 1.98847e30; // kg
export const M_EARTH = 5.9722e24; // kg
export const AU = 1.495978707e11; // m
export const YEAR = 3.15576e7; // s (Julian year)
export const G_SIM = 4 * Math.PI * Math.PI;
export const AU_PER_YR_TO_KM_S = AU / YEAR / 1000; // ≈ 4.74

/** Force magnitude in newtons for masses in M☉ and separation in AU. */
export function forceSI(m1Sun: number, m2Sun: number, rAU: number, p = 2): number {
  // For p ≠ 2 the constant is chosen so all laws agree at r = 1 AU (a fair comparison).
  const r = rAU * AU;
  const base = (G_SI * m1Sun * M_SUN * m2Sun * M_SUN) / (AU * AU);
  return base * Math.pow(r / AU, -p);
}

export interface Body {
  m: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function accel(bodies: Body[], p: number, soft: number, ax: Float64Array, ay: Float64Array) {
  ax.fill(0);
  ay.fill(0);
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + soft * soft;
      const r = Math.sqrt(r2);
      // |F|/(m_a m_b) = G / r^p  →  a_a = G m_b / r^p  along r̂
      const f = G_SIM / Math.pow(r, p) / r;
      ax[i] += f * b.m * dx;
      ay[i] += f * b.m * dy;
      ax[j] -= f * a.m * dx;
      ay[j] -= f * a.m * dy;
    }
}

/** Velocity-Verlet (kick-drift-kick) integrator: symplectic, conserves energy well for orbits. */
export function verletStep(bodies: Body[], dt: number, p: number, soft: number, ax: Float64Array, ay: Float64Array) {
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += 0.5 * dt * ax[i];
    bodies[i].vy += 0.5 * dt * ay[i];
    bodies[i].x += dt * bodies[i].vx;
    bodies[i].y += dt * bodies[i].vy;
  }
  accel(bodies, p, soft, ax, ay);
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vx += 0.5 * dt * ax[i];
    bodies[i].vy += 0.5 * dt * ay[i];
  }
}

/** Total mechanical energy (sim units) for the inverse-square law. */
export function totalEnergy(bodies: Body[], soft = 0): number {
  let e = 0;
  for (const b of bodies) e += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const r = Math.sqrt((bodies[i].x - bodies[j].x) ** 2 + (bodies[i].y - bodies[j].y) ** 2 + soft * soft);
      e -= (G_SIM * bodies[i].m * bodies[j].m) / r;
    }
  return e;
}

/** Circular orbital speed of the relative motion for separation r (sim units). */
export const circularSpeed = (mTotal: number, r: number) => Math.sqrt((G_SIM * mTotal) / r);
export const escapeSpeed = (mTotal: number, r: number) => Math.sqrt((2 * G_SIM * mTotal) / r);
/** Kepler's third law: period in years for semi-major axis a (AU) and total mass (M☉). */
export const keplerPeriod = (a: number, mTotal: number) => Math.sqrt((a * a * a) / mTotal);

/**
 * Two-body initial conditions in the centre-of-mass frame. Relative speed = factor × v_circ,
 * at angle `angle` (radians) from the perpendicular to the line of centres.
 */
export function twoBodyInit(m1: number, m2: number, r: number, speedFactor: number, angle = 0): Body[] {
  const M = m1 + m2;
  const vrel = speedFactor * circularSpeed(M, r);
  const vx = -Math.sin(angle) * vrel;
  const vy = Math.cos(angle) * vrel;
  // positions along x with COM at origin
  const x1 = (-m2 / M) * r;
  const x2 = (m1 / M) * r;
  return [
    { m: m1, x: x1, y: 0, vx: (-m2 / M) * vx, vy: (-m2 / M) * vy },
    { m: m2, x: x2, y: 0, vx: (m1 / M) * vx, vy: (m1 / M) * vy },
  ];
}

/** Orbital elements of the relative orbit (inverse-square only). */
export function relativeOrbit(bodies: Body[]) {
  const [a, b] = bodies;
  const M = a.m + b.m;
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const vx = b.vx - a.vx;
  const vy = b.vy - a.vy;
  const r = Math.hypot(rx, ry);
  const v2 = vx * vx + vy * vy;
  const mu = G_SIM * M;
  const eps = 0.5 * v2 - mu / r; // specific orbital energy
  const h = rx * vy - ry * vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (mu * mu)));
  const semiMajor = eps < 0 ? -mu / (2 * eps) : Infinity;
  return { r, v: Math.sqrt(v2), eps, e, semiMajor, bound: eps < 0, period: eps < 0 ? keplerPeriod(semiMajor, M) : Infinity };
}
