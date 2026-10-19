import { useEffect, useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Slider, Toggle } from '../components/Controls';
import { useCanvas, useReducedMotion, useThrottledValue } from '../core/hooks';
import { arrow, FONT_MONO, text } from '../core/draw';
import {
  accel,
  AU_PER_YR_TO_KM_S,
  circularSpeed,
  forceSI,
  G_SIM,
  M_EARTH,
  M_SUN,
  relativeOrbit,
  twoBodyInit,
  verletStep,
} from '../math/gravity';
import { clamp, fix, fmt, mulberry32, sci } from '../math/rng';

const ORANGE = '#ffb057';
const BLUE = '#6aa8ff';
const EARTH_IN_SUN = M_EARTH / M_SUN;

function massLabel(m: number) {
  if (m >= 0.05) return `${fix(m, m < 1 ? 3 : 2)} M☉`;
  const e = m / EARTH_IN_SUN;
  return e >= 1000 ? `${fmt(e / 317.8, 3)} M♃` : `${fmt(e, 3)} M⊕`;
}

export default function Gravity() {
  const reduced = useReducedMotion();
  const [m1, setM1] = useState(1);
  const [m2, setM2] = useState(0.1);
  const [r, setR] = useState(1);
  const [speedF, setSpeedF] = useState(0.85);
  const [angle, setAngle] = useState(0);
  const [p, setP] = useState(2);
  const [running, setRunning] = useState(!reduced);
  const [timeScale, setTimeScale] = useState(0.5);
  const [showField, setShowField] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const sim = useRef({ bodies: twoBodyInit(1, 0.1, 1, 0.85), t: 0, ax: new Float64Array(2), ay: new Float64Array(2), trails: [[], []] as [number, number][][], collided: false, view: 1.3, ranSinceLaw: 0, orbitTime: 0 });
  const rHistory = useRef<number[]>([1]);
  const [doubled, setDoubled] = useState(false);
  const stars = useMemo(() => {
    const rnd = mulberry32(4);
    return Array.from({ length: 260 }, () => [rnd(), rnd(), rnd()]);
  }, []);

  const restart = (nm1 = m1, nm2 = m2, nr = r, ns = speedF, na = angle) => {
    const s = sim.current;
    s.bodies = twoBodyInit(nm1, nm2, nr, ns, (na * Math.PI) / 180);
    s.t = 0;
    s.trails = [[], []];
    s.collided = false;
    s.orbitTime = 0;
    accel(s.bodies, p, 0.002, s.ax, s.ay);
  };

  // Masses can change mid-flight: the force responds immediately.
  useEffect(() => {
    const s = sim.current;
    s.bodies[0].m = m1;
    s.bodies[1].m = m2;
    accel(s.bodies, p, 0.002, s.ax, s.ay);
  }, [m1, m2, p]);

  useEffect(() => {
    sim.current.ranSinceLaw = 0;
  }, [p]);

  const live = useThrottledValue(() => {
    const s = sim.current;
    const [A, B] = s.bodies;
    const sep = Math.hypot(B.x - A.x, B.y - A.y);
    const orb = relativeOrbit(s.bodies);
    return { sep, orb, t: s.t, collided: s.collided, ranSinceLaw: s.ranSinceLaw, orbitTime: s.orbitTime };
  }, 150);

  const force = forceSI(m1, m2, live.sep, p);
  const vc = circularSpeed(m1 + m2, r);

  useGoalWhen('grav-double', doubled);
  useGoalWhen('grav-circle', p === 2 && Math.abs(speedF - 1) < 0.015 && Math.abs(angle) < 2 && live.orbitTime > 0.2 && live.orb.e < 0.05);
  useGoalWhen('grav-escape', live.orb.eps >= 0 && p === 2 && live.t > 0.05);
  useGoalWhen('grav-law', Math.abs(p - 2) > 0.2 && live.ranSinceLaw > 1.2);

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt, time }) => {
      const s = sim.current;
      // physics
      if (running && !s.collided) {
        const simDt = dt * timeScale;
        let remaining = simDt;
        let guard = 0;
        while (remaining > 1e-9 && guard < 4000) {
          const [A, B] = s.bodies;
          const sep = Math.hypot(B.x - A.x, B.y - A.y);
          const M = A.m + B.m;
          const step = Math.min(remaining, (0.004 * Math.pow(Math.max(sep, 0.02), 1.5)) / Math.sqrt(M));
          verletStep(s.bodies, step, p, 0.002, s.ax, s.ay);
          remaining -= step;
          s.t += step;
          guard++;
          const rad = bodyRadiusAU(A.m) + bodyRadiusAU(B.m);
          if (sep < rad * 0.6) {
            s.collided = true;
            break;
          }
        }
        s.orbitTime += simDt;
        s.ranSinceLaw += dt;
        for (let k = 0; k < 2; k++) {
          const tr = s.trails[k];
          tr.push([s.bodies[k].x, s.bodies[k].y]);
          if (tr.length > 900) tr.shift();
        }
      }
      // camera: fit the bound orbit (or follow escaping bodies), smoothly
      const orb = relativeOrbit(s.bodies);
      const [A, B] = s.bodies;
      const sep = Math.hypot(B.x - A.x, B.y - A.y);
      const extent = orb.bound && p === 2 ? orb.semiMajor * (1 + orb.e) : sep;
      const target = clamp(Math.max(extent, sep) * 1.12, 0.3, 40);
      s.view += (target - s.view) * 0.03;
      const mob = w < 700;
      const cx = w / 2;
      const cy = mob ? h * 0.58 : h * 0.56;
      const scale = (Math.min(w, h - (mob ? 130 : 160)) / 2 / s.view) * 0.92;
      const X = (x: number) => cx + x * scale;
      const Y = (y: number) => cy - y * scale;

      ctx.fillStyle = '#03040a';
      ctx.fillRect(0, 0, w, h);
      for (const [sx, sy, sz] of stars) {
        ctx.fillStyle = `rgba(200,215,255,${0.15 + 0.4 * sz * (0.7 + 0.3 * Math.sin(time + sx * 20))})`;
        ctx.fillRect(sx * w, sy * h, sz * 1.5 + 0.3, sz * 1.5 + 0.3);
      }
      // gravitational field strength map
      if (showField) {
        const cell = mob ? 14 : 16;
        for (let py = 0; py < h; py += cell)
          for (let px = 0; px < w; px += cell) {
            const x = (px + cell / 2 - cx) / scale;
            const y = -(py + cell / 2 - cy) / scale;
            let gx = 0;
            let gy = 0;
            for (const b of s.bodies) {
              const dx = b.x - x;
              const dy = b.y - y;
              const rr = Math.max(Math.hypot(dx, dy), 0.01);
              const g = (G_SIM * b.m) / Math.pow(rr, p);
              gx += (g * dx) / rr;
              gy += (g * dy) / rr;
            }
            const gm = Math.hypot(gx, gy);
            const lv = clamp((Math.log10(gm) + 1) / 5, 0, 1);
            ctx.fillStyle = `rgba(${40 + 200 * lv},${60 + 80 * lv},${200 - 80 * lv},${0.05 + 0.22 * lv})`;
            ctx.fillRect(px, py, cell - 1, cell - 1);
            if ((px / cell) % 2 === 0 && (py / cell) % 2 === 0) {
              const L = 4 + 8 * lv;
              arrow(ctx, px + cell / 2, py + cell / 2, px + cell / 2 + (gx / gm) * L, py + cell / 2 - (gy / gm) * L, `rgba(220,230,255,${0.25 + 0.4 * lv})`, 1, 4);
            }
          }
      }
      // orbit trails
      if (showTrails) {
        s.trails.forEach((tr, k) => {
          if (tr.length < 2) return;
          ctx.lineWidth = 1.5;
          for (let i = 1; i < tr.length; i++) {
            const a = i / tr.length;
            ctx.strokeStyle = k === 0 ? `rgba(255,176,87,${a * 0.7})` : `rgba(106,168,255,${a * 0.85})`;
            ctx.beginPath();
            ctx.moveTo(X(tr[i - 1][0]), Y(tr[i - 1][1]));
            ctx.lineTo(X(tr[i][0]), Y(tr[i][1]));
            ctx.stroke();
          }
        });
      }
      // centre of mass
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx, cy + 5);
      ctx.stroke();
      // bodies
      s.bodies.forEach((b, k) => {
        const rad = clamp(4 + 7 * Math.cbrt(b.m / 0.05), 3.5, 26);
        const col = k === 0 ? ORANGE : BLUE;
        const g = ctx.createRadialGradient(X(b.x), Y(b.y), 0, X(b.x), Y(b.y), rad * 3.2);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.25, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(X(b.x), Y(b.y), rad * 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
      // force vectors: equal and opposite
      if (showVectors) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1;
        const F = forceSI(A.m, B.m, d, p);
        const L = clamp(20 + 9 * (Math.log10(F) - 18), 14, 120);
        arrow(ctx, X(A.x), Y(A.y), X(A.x) + (dx / d) * L, Y(A.y) - (dy / d) * L, '#ffffff', 2, 9, 8);
        arrow(ctx, X(B.x), Y(B.y), X(B.x) - (dx / d) * L, Y(B.y) + (dy / d) * L, '#ffffff', 2, 9, 8);
        text(ctx, `F = ${sci(F, 3)} N`, (X(A.x) + X(B.x)) / 2, (Y(A.y) + Y(B.y)) / 2 - 12, { align: 'center', size: 12, font: FONT_MONO, color: 'rgba(255,255,255,0.85)', shadow: true });
        // velocity
        for (const [k, bd] of s.bodies.entries()) {
          const vs = Math.hypot(bd.vx, bd.vy);
          if (vs < 1e-6) continue;
          const VL = clamp(vs * 6, 6, 70);
          arrow(ctx, X(bd.x), Y(bd.y), X(bd.x) + (bd.vx / vs) * VL, Y(bd.y) - (bd.vy / vs) * VL, k === 0 ? 'rgba(255,176,87,0.8)' : 'rgba(106,168,255,0.9)', 1.4, 6);
        }
      }
      // scale bar
      const bar = niceAU(s.view * 0.5);
      ctx.strokeStyle = 'rgba(200,210,240,0.6)';
      ctx.beginPath();
      ctx.moveTo(w - 30 - bar * scale, h - 30);
      ctx.lineTo(w - 30, h - 30);
      ctx.stroke();
      text(ctx, `${bar} AU`, w - 30 - (bar * scale) / 2, h - 38, { align: 'center', size: 11, font: FONT_MONO, color: 'rgba(200,210,240,0.8)' });
      text(ctx, `t = ${fix(s.t, 2)} yr`, w - 30, h - 52, { align: 'right', size: 11, font: FONT_MONO, color: 'rgba(200,210,240,0.6)' });
    },
    { animate: true },
  );

  const reset = () => {
    setM1(1);
    setM2(0.1);
    setR(1);
    setSpeedF(0.85);
    setAngle(0);
    setP(2);
    setTimeScale(0.5);
    rHistory.current = [1];
    setDoubled(false);
    restart(1, 0.1, 1, 0.85, 0);
    setRunning(!reduced);
  };

  const onR = (v: number) => {
    setR(v);
    if (rHistory.current.some((old) => Math.abs(v / old - 2) < 0.04 || Math.abs(old / v - 2) < 0.04)) setDoubled(true);
    rHistory.current.push(v);
    if (rHistory.current.length > 200) rHistory.current.shift();
    restart(m1, m2, v, speedF, angle);
  };

  const orb = live.orb;
  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Two bodies orbiting under mutual gravity with force vectors and trails" />}
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setRunning((x) => !x)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Run'}
          </Btn>
          <Btn onClick={() => restart()} icon={Icon.step} title="Relaunch from the starting configuration">
            Relaunch
          </Btn>
        </>
      }
      legend={
        <>
          <span className="legend-item"><i className="legend-swatch" style={{ background: '#fff' }} /> gravitational force (equal &amp; opposite)</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: BLUE }} /> velocity</span>
        </>
      }
      notice={
        live.collided ? (
          <Callout tone="warn">The bodies collided. Relaunch with more sideways speed.</Callout>
        ) : p !== 2 ? (
          <Callout tone="event">
            Force ∝ 1/r<sup>{fix(p, 1)}</sup> is <strong>not</strong> Newton’s law. Only the inverse square gives closed elliptical orbits.
          </Callout>
        ) : orb.eps >= 0 ? (
          <Callout tone="event">
            <strong>Escape!</strong> Total energy ≥ 0, so the bodies are unbound and will not return.
          </Callout>
        ) : doubled ? (
          <Callout tone="success">Doubling the separation divides the force by 2² = 4.</Callout>
        ) : undefined
      }
      controls={
        <>
          <ControlGroup title="Masses & distance">
            <Slider label="Mass 1 (star)" tex="m_1" value={m1} min={EARTH_IN_SUN} max={3} log onChange={setM1} format={massLabel} tip="Changes take effect instantly, even mid-orbit." />
            <Slider label="Mass 2" tex="m_2" value={m2} min={EARTH_IN_SUN} max={3} log onChange={setM2} format={massLabel} />
            <Slider label="Separation" tex="r" value={r} min={0.2} max={5} step={0.01} onChange={onR} format={(v) => fix(v, 2)} unit="AU" tip="Restarts the orbit at this separation." />
          </ControlGroup>
          <ControlGroup title="Launch">
            <Slider
              label="Launch speed"
              value={speedF}
              min={0}
              max={1.8}
              step={0.005}
              onChange={(v) => {
                setSpeedF(v);
                restart(m1, m2, r, v, angle);
              }}
              format={(v) => `${fix(v, 3)} × v꜀`}
              marks={[
                { value: 1, label: 'circular' },
                { value: Math.SQRT2, label: 'escape' },
              ]}
              tip="Relative speed as a multiple of the circular-orbit speed √(G(m₁+m₂)/r). √2 × is escape speed."
            />
            <Slider
              label="Launch angle"
              value={angle}
              min={-80}
              max={80}
              step={1}
              onChange={(v) => {
                setAngle(v);
                restart(m1, m2, r, speedF, v);
              }}
              format={(v) => fix(v, 0)}
              unit="°"
            />
            <div className="btn-row">
              <Btn onClick={() => { setM1(1); setM2(EARTH_IN_SUN); setSpeedF(1); setAngle(0); setR(1); restart(1, EARTH_IN_SUN, 1, 1, 0); setRunning(true); }}>Sun + Earth</Btn>
              <Btn onClick={() => { setM1(1); setM2(0.8); setSpeedF(0.9); setAngle(0); setR(2); restart(1, 0.8, 2, 0.9, 0); setRunning(true); }}>Binary star</Btn>
              <Btn onClick={() => { setM1(1); setM2(0.001); setSpeedF(1.2); setAngle(0); setR(0.6); restart(1, 0.001, 0.6, 1.2, 0); setRunning(true); }}>Comet-like</Btn>
            </div>
          </ControlGroup>
          <ControlGroup title="Law & display">
            <Slider label="Distance exponent" value={p} min={1} max={3} step={0.1} onChange={(v) => { setP(Number(v.toFixed(1))); }} format={(v) => `1/r^${fix(v, 1)}`} marks={[{ value: 2, label: 'Newton' }]} tip="Newton’s law has exponent exactly 2. Other values are hypothetical laws for comparison (normalised to agree at 1 AU)." />
            <Slider label="Time speed" value={timeScale} min={0.05} max={5} log onChange={setTimeScale} format={(v) => fix(v, 2)} unit="yr/s" />
            <div className="toggle-row">
              <Toggle label="Trails" checked={showTrails} onChange={setShowTrails} />
              <Toggle label="Vectors" checked={showVectors} onChange={setShowVectors} />
              <Toggle label="Field strength" checked={showField} onChange={setShowField} />
            </div>
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'force now', value: `${sci(force, 3)} N`, accent: true },
            { label: 'separation', value: `${fix(live.sep, 3)} AU` },
            { label: 'relative speed', value: `${fix(orb.v * AU_PER_YR_TO_KM_S, 2)} km/s` },
            { label: 'circular speed at r', value: `${fix(vc * AU_PER_YR_TO_KM_S, 2)} km/s` },
            { label: 'eccentricity', value: p === 2 ? fix(orb.e, 3) : 'n/a (not 1/r²)' },
            { label: 'orbit', value: p !== 2 ? '—' : orb.bound ? `bound, P = ${fix(orb.period, 3)} yr` : 'unbound (escape)' },
          ]}
        />
      }
    />
  );
}

function bodyRadiusAU(m: number) {
  // very rough physical radius scaled up for visibility of collisions (Sun ≈ 0.00465 AU)
  return 0.0046 * Math.pow(m, 0.8) + 0.003;
}

function niceAU(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return Number(((n < 2 ? 1 : n < 5 ? 2 : 5) * p).toPrecision(2));
}
