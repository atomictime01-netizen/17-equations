import { useEffect, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { useCanvas, useLatest, usePointer, useQualityLow, useReducedMotion, useThrottledValue } from '../core/hooks';
import { arrow, FONT_MONO, text } from '../core/draw';
import type { FluidMode } from '../math/fluid';
import type { FluidFrame, FluidIn, FluidView, ObstacleShape } from '../workers/fluid.worker';
import { clamp, fix, fmt } from '../math/rng';

type Tool = 'push' | 'wall' | 'erase';

function hueColor(h: number): [number, number, number] {
  const r = 0.5 + 0.5 * Math.cos(2 * Math.PI * (h + 0.0));
  const g = 0.5 + 0.5 * Math.cos(2 * Math.PI * (h + 0.33));
  const b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (h + 0.67));
  return [r * 1.4, g * 1.4, b * 1.4];
}

export default function Fluid() {
  const reduced = useReducedMotion();
  const low = useQualityLow();
  const NX = low ? 112 : 160;
  const NY = low ? 64 : 90;
  const [mode, setMode] = useState<FluidMode>('tunnel');
  const [obstacle, setObstacle] = useState<ObstacleShape>('cylinder');
  const [view, setView] = useState<FluidView>('dye');
  const [tool, setTool] = useState<Tool>('push');
  const [mu, setMu] = useState(0.002);
  const [rho, setRho] = useState(1);
  const [inflow, setInflow] = useState(0.9);
  const [vort, setVort] = useState(0.0);
  const [smoke, setSmoke] = useState(true);
  const [arrows, setArrows] = useState(false);
  const [streamlines, setStreamlines] = useState(false);
  const [running, setRunning] = useState(true);
  const [stirred, setStirred] = useState(0);
  const [honeyStir, setHoneyStir] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<FluidFrame | null>(null);
  const pending = useRef(false);
  const off = useRef<HTMLCanvasElement | null>(null);
  const hue = useRef(0);
  const fps = useRef({ frames: 0, t: performance.now(), sps: 0 });
  const params = useLatest({ running, view, mu, rho, inflow, vort, smoke });
  const [workerOk, setWorkerOk] = useState(true);

  const send = (m: FluidIn) => workerRef.current?.postMessage(m);

  useEffect(() => {
    let w: Worker;
    try {
      w = new Worker(new URL('../workers/fluid.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setWorkerOk(false);
      return;
    }
    workerRef.current = w;
    pending.current = false; // a request sent to a previous (terminated) worker will never be answered
    w.onmessage = (e: MessageEvent<FluidFrame>) => {
      frameRef.current = e.data;
      pending.current = false;
      fps.current.frames++;
    };
    w.onerror = () => setWorkerOk(false);
    w.postMessage({ type: 'init', nx: NX, ny: NY, mode: 'tunnel', obstacle: 'cylinder' } satisfies FluidIn);
    w.postMessage({ type: 'params', mu, rho, inflow, vorticity: vort, smoke } satisfies FluidIn);
    return () => {
      w.terminate();
      workerRef.current = null;
      pending.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [NX, NY]);

  useEffect(() => {
    send({ type: 'params', mu, rho, inflow, vorticity: vort, smoke });
  }, [mu, rho, inflow, vort, smoke]);

  // a short automated stir in the tank so the scene opens in motion
  useEffect(() => {
    if (mode !== 'tank' || reduced) return;
    let k = 0;
    const id = window.setInterval(() => {
      const a = k * 0.35;
      send({ type: 'splat', x: NX / 2 + Math.cos(a) * NY * 0.25, y: NY / 2 + Math.sin(a) * NY * 0.25, fx: -Math.sin(a) * 0.9, fy: Math.cos(a) * 0.9, r: 4, color: hueColor(k * 0.04) });
      if (++k > 36) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const live = useThrottledValue(() => {
    const f = frameRef.current;
    const now = performance.now();
    const st = fps.current;
    if (now - st.t > 1000) {
      st.sps = (st.frames * 1000) / (now - st.t);
      st.frames = 0;
      st.t = now;
    }
    return { maxDiv: f?.maxDiv ?? 0, maxSpeed: f?.maxSpeed ?? 0, steps: f?.steps ?? 0, sps: st.sps };
  }, 400);

  useGoalWhen('ns-stir', stirred > 1400);
  useGoalWhen('ns-visc', honeyStir);
  useGoalWhen('ns-pressure', view === 'pressure' && obstacle !== 'none');

  const geom = (w: number, h: number) => {
    const mob = w < 700;
    const top = mob ? 112 : 140;
    const availW = w - (mob ? 16 : 40);
    const availH = h - top - 62;
    const s = Math.min(availW / NX, availH / NY);
    const ox = (w - NX * s) / 2;
    const oy = top + (availH - NY * s) / 2;
    return { s, ox, oy, toGrid: (px: number, py: number) => [(px - ox) / s, NY - (py - oy) / s] as [number, number] };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h }) => {
      const P = params.current;
      if (P.running && !pending.current && workerRef.current) {
        pending.current = true;
        workerRef.current.postMessage({ type: 'frame', steps: 1, view: P.view } satisfies FluidIn);
      } else if (!P.running && !pending.current && workerRef.current && frameRef.current) {
        // keep rendering the latest view when paused (e.g. switching layers)
        pending.current = true;
        workerRef.current.postMessage({ type: 'frame', steps: 0, view: P.view } satisfies FluidIn);
      }
      ctx.fillStyle = '#03040a';
      ctx.fillRect(0, 0, w, h);
      const f = frameRef.current;
      const g = geom(w, h);
      if (!f) {
        text(ctx, 'Starting the solver…', w / 2, h / 2, { align: 'center', color: 'rgba(200,210,240,0.7)' });
        return;
      }
      if (!off.current) off.current = document.createElement('canvas');
      const oc = off.current;
      if (oc.width !== f.nx || oc.height !== f.ny) {
        oc.width = f.nx;
        oc.height = f.ny;
      }
      const octx = oc.getContext('2d')!;
      octx.putImageData(new ImageData(f.img, f.nx, f.ny), 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(oc, g.ox, g.oy, f.nx * g.s, f.ny * g.s);
      ctx.restore();
      ctx.strokeStyle = 'rgba(56,243,212,0.3)';
      ctx.strokeRect(g.ox - 0.5, g.oy - 0.5, f.nx * g.s + 1, f.ny * g.s + 1);
      const X = (gx: number) => g.ox + gx * g.s;
      const Y = (gy: number) => g.oy + (f.ny - gy) * g.s;
      const sample = (x: number, y: number): [number, number] => {
        const fx = clamp(x - 0.5, 0, f.nx - 1.001);
        const fy = clamp(y - 0.5, 0, f.ny - 1.001);
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        const a = fx - i;
        const b = fy - j;
        const k = j * f.nx + i;
        const bl = (A: Float32Array) => (1 - b) * ((1 - a) * A[k] + a * A[k + 1]) + b * ((1 - a) * A[k + f.nx] + a * A[k + f.nx + 1]);
        return [bl(f.uc), bl(f.vc)];
      };
      if (streamlines) {
        ctx.lineWidth = 1;
        const sx = 18;
        const sy = 10;
        for (let a = 0; a < sx; a++)
          for (let b = 0; b < sy; b++) {
            let x = ((a + 0.5) / sx) * f.nx;
            let y = ((b + 0.5) / sy) * f.ny;
            ctx.beginPath();
            ctx.moveTo(X(x), Y(y));
            for (let s = 0; s < 40; s++) {
              const [u, v] = sample(x, y);
              const sp = Math.hypot(u, v);
              if (sp < 1e-4) break;
              const [u2, v2] = sample(x + (0.5 * u) / sp, y + (0.5 * v) / sp);
              const sp2 = Math.hypot(u2, v2) || 1;
              x += u2 / sp2;
              y += v2 / sp2;
              if (x < 0 || y < 0 || x > f.nx || y > f.ny) break;
              const k = Math.floor(y) * f.nx + Math.floor(x);
              if (f.solid[k]) break;
              ctx.lineTo(X(x), Y(y));
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.stroke();
          }
      }
      if (arrows) {
        const step = Math.max(4, Math.round(f.nx / 26));
        for (let j = step / 2; j < f.ny; j += step)
          for (let i = step / 2; i < f.nx; i += step) {
            const k = Math.floor(j) * f.nx + Math.floor(i);
            if (f.solid[k]) continue;
            const u = f.uc[k];
            const v = f.vc[k];
            const sp = Math.hypot(u, v);
            if (sp < 1e-4) continue;
            const L = Math.min(1, sp / Math.max(f.maxSpeed, 1e-6)) * step * g.s * 0.9;
            arrow(ctx, X(i), Y(j), X(i) + (u / sp) * L, Y(j) - (v / sp) * L, 'rgba(255,255,255,0.75)', 1.1, 5);
          }
      }
      text(ctx, `${f.nx} × ${f.ny} MAC grid · step ${f.steps}`, g.ox + 6, g.oy + f.ny * g.s - 8, { size: 10, color: 'rgba(220,230,255,0.6)', font: FONT_MONO });
    },
    { animate: true },
  );

  const lastPt = useRef<[number, number] | null>(null);
  usePointer(canvasRef, {
    down: (p) => {
      const el = canvasRef.current!;
      const g = geom(el.clientWidth, el.clientHeight);
      const [gx, gy] = g.toGrid(p.x, p.y);
      if (gx < 0 || gy < 0 || gx > NX || gy > NY) return false;
      lastPt.current = [gx, gy];
      if (tool !== 'push') send({ type: 'paint', x: gx, y: gy, r: 2.5, value: tool === 'wall' ? 1 : 0 });
      if (tool === 'wall' || tool === 'erase') setObstacle('none');
    },
    move: (p, dragging) => {
      if (!dragging || !lastPt.current) return;
      const el = canvasRef.current!;
      const g = geom(el.clientWidth, el.clientHeight);
      const [gx, gy] = g.toGrid(p.x, p.y);
      const [lx, ly] = lastPt.current;
      if (tool === 'push') {
        const dx = gx - lx;
        const dy = gy - ly;
        hue.current = (hue.current + 0.004) % 1;
        send({ type: 'splat', x: gx, y: gy, fx: clamp(dx * 0.9, -3, 3), fy: clamp(dy * 0.9, -3, 3), r: 3.2, color: hueColor(hue.current) });
        setStirred((s) => s + Math.hypot(p.dx, p.dy));
        if (mu >= 0.5) setHoneyStir(true);
      } else send({ type: 'paint', x: gx, y: gy, r: 2.5, value: tool === 'wall' ? 1 : 0 });
      lastPt.current = [gx, gy];
    },
    up: () => (lastPt.current = null),
  });

  const nu = mu / rho;
  const D = obstacle === 'none' ? 0 : NY * 0.17;
  const Re = nu > 0 && D > 0 && mode === 'tunnel' ? (inflow * D) / nu : Infinity;

  const reset = () => {
    setMu(0.002);
    setRho(1);
    setInflow(0.9);
    setVort(0);
    setView('dye');
    setTool('push');
    setRunning(true);
    send({ type: 'reset' });
  };

  return (
    <ExperienceShell
      stage={
        <>
          <canvas ref={canvasRef} aria-label="Fluid simulation. Drag to push the fluid and inject dye." />
          {!workerOk && <div className="error-box">This browser could not start the simulation worker, so the fluid cannot run here.</div>}
        </>
      }
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Run'}
          </Btn>
          {!running && (
            <Btn onClick={() => send({ type: 'frame', steps: 1, view })} icon={Icon.step}>
              Step
            </Btn>
          )}
        </>
      }
      notice={
        mu >= 0.5 ? (
          <Callout tone="event">Very viscous: momentum diffuses away almost instantly, like stirring honey.</Callout>
        ) : mode === 'tunnel' && Number.isFinite(Re) && Re > 60 && obstacle !== 'none' && view === 'dye' ? (
          <Callout tone="info">At this Reynolds number the wake becomes unstable and sheds alternating vortices (a Kármán street). Give it a few seconds.</Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="Experiment"
            value={mode}
            onChange={(m) => {
              setMode(m);
              send({ type: 'mode', mode: m });
            }}
            options={[
              { value: 'tunnel', label: 'Wind tunnel' },
              { value: 'tank', label: 'Closed tank' },
            ]}
          />
          <Segmented
            label="Obstacle"
            value={obstacle}
            onChange={(o) => {
              setObstacle(o);
              send({ type: 'obstacle', shape: o });
            }}
            options={[
              { value: 'cylinder', label: 'Cylinder' },
              { value: 'plate', label: 'Plate' },
              { value: 'wing', label: 'Wing' },
              { value: 'pair', label: 'Two cylinders' },
              { value: 'none', label: 'None' },
            ]}
          />
          <Segmented
            label="Pointer tool"
            value={tool}
            onChange={setTool}
            options={[
              { value: 'push', label: 'Push & dye' },
              { value: 'wall', label: 'Draw walls' },
              { value: 'erase', label: 'Erase walls' },
            ]}
          />
          <Segmented
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: 'dye', label: 'Dye' },
              { value: 'speed', label: 'Speed |u|' },
              { value: 'pressure', label: 'Pressure p' },
              { value: 'vorticity', label: 'Vorticity' },
            ]}
          />
          <div className="toggle-row">
            <Toggle label="Velocity arrows" checked={arrows} onChange={setArrows} />
            <Toggle label="Streamlines" checked={streamlines} onChange={setStreamlines} />
            {mode === 'tunnel' && <Toggle label="Smoke lines" checked={smoke} onChange={setSmoke} />}
          </div>
          <ControlGroup title="Fluid properties">
            <Slider label="Viscosity" tex="\mu" value={mu} min={0.0002} max={1} log onChange={setMu} format={(v) => fmt(v, 2)} tip="Dynamic viscosity in lattice units. The solver also has some numerical diffusion, so the effective viscosity is never exactly zero." />
            <Slider label="Density" tex="\rho" value={rho} min={0.25} max={4} log onChange={setRho} format={(v) => fix(v, 2)} tip="Heavier fluid accelerates less for the same push (a = f/ρ) and has lower kinematic viscosity ν = μ/ρ." />
            {mode === 'tunnel' && <Slider label="Inflow speed" tex="U" value={inflow} min={0.2} max={1.5} step={0.01} onChange={setInflow} format={(v) => fix(v, 2)} unit="cells/step" />}
            <Slider label="Vorticity confinement" value={vort} min={0} max={0.35} step={0.005} onChange={setVort} format={(v) => fix(v, 3)} tip="A numerical correction that re-injects small-scale swirl lost to numerical diffusion. Not part of the Navier–Stokes equations — leave at 0 for the plain solver." />
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'kinematic viscosity ν', value: fmt(nu, 3) },
            { label: 'nominal Reynolds number', value: Number.isFinite(Re) ? fmt(Re, 3) : '—', accent: true, hint: 'Re = U·D/ν with the obstacle size D' },
            { label: 'max |∇·u| after projection', value: live.maxDiv.toExponential(1), hint: 'Incompressibility residual from the pressure solve' },
            { label: 'max speed', value: `${fix(live.maxSpeed, 2)} cells/step` },
            { label: 'solver rate', value: `${fix(live.sps, 0)} steps/s` },
            { label: 'steps', value: String(live.steps) },
          ]}
        />
      }
    />
  );
}
