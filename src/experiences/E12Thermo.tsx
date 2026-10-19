import { useEffect, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Slider, Toggle } from '../components/Controls';
import { useCanvas, useReducedMotion, useThrottledValue } from '../core/hooks';
import { FONT_MONO, text } from '../core/draw';
import { GasBox, lnMultiplicity, maxLnMultiplicity } from '../math/thermo';
import { clamp, fix, fmt, mulberry32, sci } from '../math/rng';

const EMBER = '#ff7a45';
const ICE = '#45b6ff';
const KB = 1.380649e-23;

export default function Thermodynamics() {
  const reduced = useReducedMotion();
  const [N, setN] = useState(400);
  const [leftFrac, setLeftFrac] = useState(1);
  const [temp, setTemp] = useState(1);
  const [two, setTwo] = useState(false);
  const [collisions, setCollisions] = useState(true);
  const [grid, setGrid] = useState(4);
  const [running, setRunning] = useState(!reduced);
  const [released, setReleased] = useState(false);
  const [closed, setClosed] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [seed, setSeed] = useState(1);
  const gas = useRef(new GasBox());
  const hist = useRef<{ t: number; s: number; f: number }[]>([]);
  const simT = useRef(0);
  const wallAnim = useRef(1); // 1 = wall fully in place
  const allLeftEvents = useRef(0);
  const prevAllLeft = useRef(true);
  const [smallSeen, setSmallSeen] = useState(false);

  const init = (n = N, lf = leftFrac, t2 = two, sd = seed) => {
    const g = gas.current;
    g.init(n, { leftFraction: lf, speed: 0.32, twoSpecies: t2, seed: mulberry32(sd * 7919) });
    g.partition = true;
    g.collisions = collisions;
    hist.current = [];
    simT.current = 0;
    wallAnim.current = 1;
    allLeftEvents.current = 0;
    prevAllLeft.current = lf === 1;
    setReleased(false);
    setReversed(false);
    setClosed(true);
  };
  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    gas.current.collisions = collisions;
  }, [collisions]);
  const tempRef = useRef(temp);
  useEffect(() => {
    const g = gas.current;
    const k = Math.sqrt(temp / tempRef.current);
    for (let i = 0; i < g.n; i++) {
      g.vx[i] *= k;
      g.vy[i] *= k;
    }
    tempRef.current = temp;
  }, [temp]);

  const entropy = () => {
    const g = gas.current;
    if (two) return lnMultiplicity(g.occupancy(grid, grid, 0)) + lnMultiplicity(g.occupancy(grid, grid, 1));
    return lnMultiplicity(g.occupancy(grid, grid));
  };
  const maxEntropy = () => {
    const g = gas.current;
    if (two) {
      const nA = g.species.reduce((s, v) => s + (v === 0 ? 1 : 0), 0);
      return maxLnMultiplicity(nA, grid * grid) + maxLnMultiplicity(g.n - nA, grid * grid);
    }
    return maxLnMultiplicity(g.n, grid * grid);
  };

  const live = useThrottledValue(() => {
    const g = gas.current;
    const S = entropy();
    const Smax = maxEntropy();
    return { S, Smax, left: g.countLeft(), n: g.n, ke: g.kineticEnergy(), t: simT.current, events: allLeftEvents.current };
  }, 160);

  useGoalWhen('th-release', released && live.S > 0.9 * live.Smax);
  useGoalWhen('th-small', smallSeen);
  useGoalWhen('th-reverse', reversed);

  const layout = (w: number, h: number) => {
    const mob = w < 760;
    const top = mob ? 112 : 150;
    if (mob) {
      const bw = Math.min(w - 32, h - top - 220);
      return { box: { x: (w - bw) / 2, y: top, s: bw }, chart: { x: 16, y: top + bw + 18, w: w - 32, h: 150 } };
    }
    const bs = Math.min(h - top - 70, w * 0.55);
    const bx = Math.max(30, (w - bs - 300) / 2);
    return { box: { x: bx, y: top, s: bs }, chart: { x: bx + bs + 34, y: top + 10, w: Math.min(320, w - bx - bs - 60), h: bs - 20 } };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const g = gas.current;
      if (running) {
        const sub = 4;
        const step = (0.012 * Math.min(dt, 1 / 30)) / (1 / 60);
        for (let k = 0; k < sub; k++) g.step(step / sub);
        simT.current += dt;
        if (!g.partition) wallAnim.current = Math.max(0, wallAnim.current - dt * 2.5);
        else wallAnim.current = Math.min(1, wallAnim.current + dt * 2.5);
        const S = entropy();
        const Smax = maxEntropy() || 1;
        const left = g.countLeft();
        const allLeft = left === g.n;
        if (allLeft && !prevAllLeft.current && !g.partition) {
          allLeftEvents.current++;
          if (g.n <= 12) setSmallSeen(true);
        }
        prevAllLeft.current = allLeft;
        hist.current.push({ t: simT.current, s: S / Smax, f: left / g.n });
        if (hist.current.length > 900) hist.current.shift();
      }
      const L = layout(w, h);
      const { x: bx, y: by, s: bs } = L.box;
      // box
      ctx.fillStyle = 'rgba(10,14,30,0.8)';
      ctx.fillRect(bx, by, bs, bs);
      // coarse-graining cells
      ctx.strokeStyle = 'rgba(160,180,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 1; k < grid; k++) {
        ctx.moveTo(bx + (k / grid) * bs, by);
        ctx.lineTo(bx + (k / grid) * bs, by + bs);
        ctx.moveTo(bx, by + (k / grid) * bs);
        ctx.lineTo(bx + bs, by + (k / grid) * bs);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bs, bs);
      // particles
      const rad = Math.max(1.2, g.radius * bs);
      for (let i = 0; i < g.n; i++) {
        const sp = Math.hypot(g.vx[i], g.vy[i]) / (0.32 * Math.sqrt(temp));
        let col: string;
        if (two) col = g.species[i] === 0 ? EMBER : ICE;
        else {
          const t = clamp(sp / 1.6, 0, 1);
          col = `rgb(${Math.round(80 + 175 * t)},${Math.round(150 + 40 * (1 - Math.abs(t - 0.5) * 2))},${Math.round(255 - 200 * t)})`;
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx + g.x[i] * bs, by + (1 - g.y[i]) * bs, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      // partition (slides up when released)
      const wa = wallAnim.current;
      if (wa > 0.001) {
        ctx.save();
        ctx.fillStyle = '#e8edfb';
        ctx.shadowColor = '#9fd0ff';
        ctx.shadowBlur = 12;
        ctx.fillRect(bx + bs / 2 - 2, by + bs * (1 - wa), 4, bs * wa);
        ctx.restore();
      }
      // left/right counts
      const left = g.countLeft();
      text(ctx, `${left}`, bx + bs * 0.25, by - 10, { align: 'center', font: FONT_MONO, size: 13, color: 'rgba(230,235,255,0.85)' });
      text(ctx, `${g.n - left}`, bx + bs * 0.75, by - 10, { align: 'center', font: FONT_MONO, size: 13, color: 'rgba(230,235,255,0.85)' });

      // charts
      const c = L.chart;
      const half = c.h / 2 - 12;
      const drawChart = (y0: number, hh: number, key: 's' | 'f', col: string, title: string, band?: number) => {
        ctx.fillStyle = 'rgba(8,12,26,0.6)';
        ctx.fillRect(c.x, y0, c.w, hh);
        ctx.strokeStyle = 'rgba(160,180,255,0.18)';
        ctx.strokeRect(c.x, y0, c.w, hh);
        text(ctx, title, c.x + 6, y0 + 13, { size: 10.5, color: 'rgba(200,210,240,0.75)', font: FONT_MONO });
        const H = hist.current;
        if (band !== undefined) {
          // ±2 standard deviations of the binomial fraction around ½
          const sd = 0.5 / Math.sqrt(Math.max(1, g.n));
          const yA = y0 + hh * (1 - (0.5 + 2 * sd));
          const yB = y0 + hh * (1 - (0.5 - 2 * sd));
          ctx.fillStyle = 'rgba(69,182,255,0.12)';
          ctx.fillRect(c.x, yA, c.w, yB - yA);
          ctx.strokeStyle = 'rgba(69,182,255,0.4)';
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(c.x, y0 + hh * 0.5);
          ctx.lineTo(c.x + c.w, y0 + hh * 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(c.x, y0 + 20);
          ctx.lineTo(c.x + c.w, y0 + 20);
          ctx.stroke();
          ctx.setLineDash([]);
          text(ctx, 'maximum', c.x + c.w - 6, y0 + 16, { align: 'right', size: 9.5, color: 'rgba(200,210,240,0.5)', font: FONT_MONO });
        }
        if (H.length < 2) return;
        ctx.save();
        ctx.beginPath();
        H.forEach((p, i) => {
          const x = c.x + (i / 899) * c.w;
          const v = key === 's' ? p.s : p.f;
          const y = key === 's' ? y0 + 20 + (1 - v) * (hh - 26) : y0 + hh * (1 - v);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      };
      drawChart(c.y, half, 's', EMBER, 'entropy  S/k_B = ln Ω   (relative to max)');
      drawChart(c.y + half + 24, half, 'f', ICE, 'fraction of particles on the left', 1);
    },
    { animate: true },
  );

  const release = () => {
    const g = gas.current;
    g.partition = !g.partition;
    setClosed(g.partition);
    if (!g.partition) setReleased(true);
  };

  const reset = () => {
    setN(400);
    setLeftFrac(1);
    setTemp(1);
    tempRef.current = 1;
    setTwo(false);
    setCollisions(true);
    setGrid(4);
    setRunning(true);
    init(400, 1, false, seed + 1);
    setSeed((s) => s + 1);
  };

  const pAll = Math.pow(2, -live.n);
  const frac = live.Smax > 0 ? live.S / live.Smax : 1;
  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Gas particles in a box with a removable partition, with entropy charts" />}
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Run'}
          </Btn>
          <Btn variant="primary" onClick={release}>
            {closed ? 'Release partition' : 'Restore partition'}
          </Btn>
        </>
      }
      notice={
        live.events > 0 && live.n <= 14 ? (
          <Callout tone="event">
            All {live.n} particles returned to the left {live.events} time{live.events > 1 ? 's' : ''}. With so few particles (P = 2⁻ᴺ ≈ {sci(pAll, 2)}) entropy can dip — the second law is statistical.
          </Callout>
        ) : released && frac > 0.97 ? (
          <Callout tone="success">Equilibrium: ln Ω fluctuates just below its maximum. Every individual arrangement is equally likely — but almost all of them look evenly mixed.</Callout>
        ) : reversed ? (
          <Callout tone="event">Velocities reversed. The laws of motion run backwards perfectly — but tiny errors grow, and with many particles un-mixing quickly fails.</Callout>
        ) : undefined
      }
      controls={
        <>
          <ControlGroup title="Initial state">
            <Slider label="Particles" tex="N" value={N} min={6} max={1200} log step={1} onChange={(v) => setN(Math.round(v))} format={(v) => String(Math.round(v))} />
            <Slider label="Initially on the left" value={leftFrac} min={0.5} max={1} step={0.01} onChange={setLeftFrac} format={(v) => `${Math.round(v * 100)}%`} />
            <Toggle label="Two different gases (mixing)" checked={two} onChange={setTwo} tip="Left gas and right gas start separated; entropy counts arrangements of each species." />
            <Btn variant="primary" onClick={() => { init(N, leftFrac, two, seed + 1); setSeed((s) => s + 1); }}>
              Prepare this state
            </Btn>
          </ControlGroup>
          <ControlGroup title="Dynamics">
            <Slider label="Temperature (speed²)" tex="T" value={temp} min={0.2} max={3} step={0.01} onChange={setTemp} format={(v) => fix(v, 2)} tip="Rescales every speed. Kinetic energy ∝ T; mixing happens faster, but the final entropy does not depend on speed." />
            <Toggle label="Particle collisions" checked={collisions} onChange={setCollisions} />
            <Btn
              onClick={() => {
                gas.current.reverseVelocities();
                setReversed(true);
              }}
            >
              Reverse all velocities
            </Btn>
          </ControlGroup>
          <ControlGroup title="Measuring entropy">
            <Slider label="Coarse-graining cells per side" value={grid} min={2} max={8} step={1} onChange={(v) => setGrid(Math.round(v))} format={(v) => `${Math.round(v)} × ${Math.round(v)}`} tip="Entropy counts arrangements consistent with how many particles are in each cell. Finer cells, more arrangements." />
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'left : right', value: `${live.left} : ${live.n - live.left}` },
            { label: 'S/k_B = ln Ω', value: fix(live.S, 1), accent: true },
            { label: 'maximum ln Ω', value: fix(live.Smax, 1) },
            { label: 'S = k_B ln Ω', value: `${sci(KB * live.S, 3)} J/K` },
            { label: 'P(all on the left)', value: `2⁻${live.n} ≈ ${sci(pAll, 2)}` },
            { label: 'kinetic energy (conserved)', value: fmt(live.ke, 5) },
          ]}
        />
      }
    />
  );
}
