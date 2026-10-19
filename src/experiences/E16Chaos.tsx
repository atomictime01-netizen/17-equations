import { useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Slider, Toggle } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion } from '../core/hooks';
import { FONT_MONO, text } from '../core/draw';
import { attractorPeriod, LOGISTIC_LANDMARKS, logisticOrbit, lyapunov } from '../math/logistic';
import { clamp, fix } from '../math/rng';

const MAG = '#ff5cf0';
const ORA = '#ffa83d';
const CYAN = '#7af0ff';

interface View {
  r0: number;
  r1: number;
  x0: number;
  x1: number;
}
const FULL: View = { r0: 2.5, r1: 4, x0: 0, x1: 1 };

function regime(r: number, lam: number, period: number) {
  if (r < 1) return 'Extinction: the population dies out (x → 0).';
  if (r < 3) return `Stable: settles to the fixed point x* = 1 − 1/r = ${fix(1 - 1 / r, 4)}.`;
  if (r < 1 + Math.sqrt(6)) return 'Period 2: the fixed point has become unstable; the population alternates between two values.';
  if (r < 3.5440903) return 'Period 4: a second period-doubling.';
  if (r < 3.5699456) return 'Period-doubling cascade: 8, 16, 32… the doublings come faster and faster.';
  if (lam < -0.01 && period > 0) return `A periodic window inside the chaos: stable period ${period}.`;
  return 'Chaos: bounded, deterministic, never repeating, with sensitive dependence on the starting value.';
}

export default function Chaos() {
  const reduced = useReducedMotion();
  const [r, setR] = useState(reduced ? 2.9 : 2.6);
  const [x0, setX0] = useState(0.2);
  const [iters, setIters] = useState(60);
  const [compare, setCompare] = useState(false);
  const [delta, setDelta] = useState(1e-6);
  const [showLyap, setShowLyap] = useState(true);
  const [view, setView] = useState<View>(FULL);
  const [cobN, setCobN] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [sweep, setSweep] = useState(!reduced);
  const diag = useRef<{ key: string; img: ImageData | null; col: number; counts: Float32Array; lyap: Float32Array; w: number; h: number; maxC: number }>({ key: '', img: null, col: 0, counts: new Float32Array(0), lyap: new Float32Array(0), w: 0, h: 0, maxC: 1 });
  const sweepR = useRef(2.6);
  const sweepAcc = useRef(0);
  const cobT = useRef(0);
  const dragBox = useRef<null | { x0: number; y0: number; x1: number; y1: number; moved: boolean }>(null);

  const orbit = useMemo(() => logisticOrbit(r, x0, iters), [r, x0, iters]);
  const orbit2 = useMemo(() => logisticOrbit(r, clamp(x0 + delta, 0, 1), iters), [r, x0, delta, iters]);
  const lam = useMemo(() => lyapunov(r), [r]);
  const period = useMemo(() => attractorPeriod(r), [r]);
  let maxDiv = 0;
  for (let i = 0; i <= iters; i++) maxDiv = Math.max(maxDiv, Math.abs(orbit[i] - orbit2[i]));
  const divergeAt = compare ? orbit.findIndex((v, i) => Math.abs(v - orbit2[i]) > 0.1) : -1;

  useGoalWhen('lg-p2', !sweep && period === 2);
  useGoalWhen('lg-chaos', !sweep && r > 3.57 && lam > 0.05);
  useGoalWhen('lg-p3', !sweep && period === 3);
  useGoalWhen('lg-butterfly', compare && r > 3.6 && lam > 0 && divergeAt > 0);

  const layout = (w: number, h: number) => {
    const mob = w < 760;
    const top = mob ? 112 : 150;
    const total = h - top - 60;
    const dh = total * (mob ? 0.5 : 0.56);
    const pad = mob ? 30 : 56;
    const bif = { x: pad, y: top, w: w - pad - 20, h: dh };
    const lowY = top + dh + 34;
    const lowH = total - dh - 34;
    if (mob) return { bif, cob: null, ts: { x: pad, y: lowY, w: w - pad - 20, h: lowH } };
    const cw = Math.min(lowH * 1.15, w * 0.3);
    return { bif, cob: { x: pad, y: lowY, w: cw, h: lowH }, ts: { x: pad + cw + 50, y: lowY, w: w - pad - cw - 70, h: lowH } };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const L = layout(w, h);
      const B = L.bif;
      const bw = Math.max(1, Math.floor(B.w));
      const bh = Math.max(1, Math.floor(B.h));
      const key = `${bw}|${bh}|${view.r0}|${view.r1}|${view.x0}|${view.x1}`;
      const d = diag.current;
      if (d.key !== key) {
        d.key = key;
        d.w = bw;
        d.h = bh;
        d.col = 0;
        d.counts = new Float32Array(bw * bh);
        d.lyap = new Float32Array(bw);
        d.img = ctx.createImageData(bw, bh);
        d.maxC = 1;
      }
      // progressive build: real iterations, column by column
      const perFrame = reduced ? bw : Math.max(6, Math.round(bw / 70));
      const transient = 400;
      const samples = Math.round(bh * 1.2);
      for (let k = 0; k < perFrame && d.col < bw; k++, d.col++) {
        const c = d.col;
        let lsum = 0;
        for (let sub = 0; sub < 2; sub++) {
          const rr = view.r0 + ((c + (sub + 0.5) / 2) / bw) * (view.r1 - view.r0);
          let x = 0.4 + 0.1 * sub;
          for (let i = 0; i < transient; i++) x = rr * x * (1 - x);
          for (let i = 0; i < samples; i++) {
            x = rr * x * (1 - x);
            lsum += Math.log(Math.max(Math.abs(rr * (1 - 2 * x)), 1e-300));
            const row = Math.floor(((view.x1 - x) / (view.x1 - view.x0)) * bh);
            if (row >= 0 && row < bh) {
              const v = ++d.counts[row * bw + c];
              if (v > d.maxC) d.maxC = v;
            }
          }
        }
        d.lyap[c] = lsum / (2 * samples);
        // paint the finished column
        const img = d.img!;
        const norm = Math.log(1 + Math.min(d.maxC, 40));
        for (let row = 0; row < bh; row++) {
          const v = d.counts[row * bw + c];
          const o = (row * bw + c) * 4;
          if (!v) {
            img.data[o + 3] = 0;
            continue;
          }
          const t = Math.min(1, Math.log(1 + v) / norm);
          const u = c / bw;
          img.data[o] = 255 * (0.6 + 0.4 * t);
          img.data[o + 1] = 90 + 120 * u * t + 60 * t;
          img.data[o + 2] = 240 - 180 * u + 15 * t;
          img.data[o + 3] = 60 + 195 * t;
        }
      }
      ctx.fillStyle = 'rgba(6,8,18,0.8)';
      ctx.fillRect(B.x, B.y, bw, bh);
      drawDiagram(ctx, B.x, B.y, bw, bh);
      ctx.strokeStyle = 'rgba(160,180,255,0.25)';
      ctx.strokeRect(B.x, B.y, bw, bh);
      // axes labels
      for (let k = 0; k <= 5; k++) {
        const rr = view.r0 + (k / 5) * (view.r1 - view.r0);
        text(ctx, fix(rr, view.r1 - view.r0 < 0.1 ? 4 : 2), B.x + (k / 5) * bw, B.y + bh + 13, { align: 'center', size: 10, color: 'rgba(200,210,240,0.6)', font: FONT_MONO });
      }
      text(ctx, 'r', B.x + bw - 4, B.y + bh - 6, { align: 'right', size: 13, color: 'rgba(220,230,255,0.8)', italic: true });
      text(ctx, 'x (long-run values)', B.x + 6, B.y + 14, { size: 10.5, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
      // Lyapunov curve
      if (showLyap) {
        ctx.save();
        ctx.beginPath();
        const ly = (v: number) => B.y + bh - 18 - clamp(v, -2, 1) * 22 - 44;
        ctx.strokeStyle = 'rgba(122,240,255,0.25)';
        ctx.setLineDash([2, 4]);
        ctx.moveTo(B.x, ly(0));
        ctx.lineTo(B.x + bw, ly(0));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let c = 0; c < d.col; c++) (c ? ctx.lineTo(B.x + c, ly(d.lyap[c])) : ctx.moveTo(B.x + c, ly(d.lyap[c])));
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        text(ctx, 'λ (Lyapunov) — above the dashed line = chaos', B.x + 6, ly(0) - 6, { size: 9.5, color: 'rgba(122,240,255,0.7)', font: FONT_MONO });
        ctx.restore();
      }
      // current r marker and sweep
      // the opening sweep: r rises slowly so order visibly gives way to chaos
      if (sweep && !reduced) {
        sweepR.current += dt * 0.09;
        if (sweepR.current > 4) sweepR.current = 2.6;
        sweepAcc.current += dt;
        if (sweepAcc.current > 0.08) {
          sweepAcc.current = 0;
          setR(Number(sweepR.current.toFixed(4)));
        }
      }
      const rx = B.x + ((r - view.r0) / (view.r1 - view.r0)) * bw;
      if (rx >= B.x && rx <= B.x + bw) {
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = MAG;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, B.y);
        ctx.lineTo(rx, B.y + bh);
        ctx.stroke();
        ctx.restore();
        // attractor points at this r
        for (let i = Math.max(0, iters - 40); i <= iters; i++) {
          const y = B.y + ((view.x1 - orbit[i]) / (view.x1 - view.x0)) * bh;
          if (y >= B.y && y <= B.y + bh) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(rx - 2, y - 1, 4, 2);
          }
        }
      }
      // landmarks
      for (const lm of LOGISTIC_LANDMARKS) {
        const lx = B.x + ((lm.r - view.r0) / (view.r1 - view.r0)) * bw;
        if (lx < B.x || lx > B.x + bw) continue;
        ctx.strokeStyle = 'rgba(255,168,61,0.25)';
        ctx.beginPath();
        ctx.moveTo(lx, B.y + bh);
        ctx.lineTo(lx, B.y + bh - 8);
        ctx.stroke();
      }
      // zoom box
      const db = dragBox.current;
      if (db && db.moved) {
        ctx.strokeStyle = ORA;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(Math.min(db.x0, db.x1), Math.min(db.y0, db.y1), Math.abs(db.x1 - db.x0), Math.abs(db.y1 - db.y0));
        ctx.setLineDash([]);
      }

      // ── cobweb
      if (playing) {
        cobT.current += dt * 4;
        if (cobT.current >= 1) {
          cobT.current = 0;
          setCobN((n) => (n >= Math.min(iters, 80) ? 0 : n + 1));
        }
      }
      if (L.cob) {
        const C = L.cob;
        const X = (v: number) => C.x + v * C.w;
        const Y = (v: number) => C.y + C.h - v * C.h;
        ctx.strokeStyle = 'rgba(160,180,255,0.25)';
        ctx.strokeRect(C.x, C.y, C.w, C.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(X(0), Y(0));
        ctx.lineTo(X(1), Y(1));
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        for (let k = 0; k <= 100; k++) {
          const v = k / 100;
          (k ? ctx.lineTo : ctx.moveTo).call(ctx, X(v), Y(r * v * (1 - v)));
        }
        ctx.strokeStyle = MAG;
        ctx.lineWidth = 2;
        ctx.shadowColor = MAG;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = ORA;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X(orbit[0]), Y(0));
        const N = Math.min(cobN, iters);
        for (let i = 0; i < N; i++) {
          ctx.lineTo(X(orbit[i]), Y(orbit[i + 1]));
          ctx.lineTo(X(orbit[i + 1]), Y(orbit[i + 1]));
        }
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(X(orbit[N]), Y(N ? orbit[N] : 0), 3.5, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, 'cobweb: x → r x (1 − x)', C.x + 6, C.y + 13, { size: 10.5, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
      }
      // ── time series
      const T = L.ts;
      ctx.strokeStyle = 'rgba(160,180,255,0.25)';
      ctx.strokeRect(T.x, T.y, T.w, T.h);
      const tx = (i: number) => T.x + (i / iters) * T.w;
      const ty = (v: number) => T.y + T.h - v * T.h;
      const series = (o: Float64Array, col: string) => {
        ctx.beginPath();
        for (let i = 0; i <= iters; i++) (i ? ctx.lineTo(tx(i), ty(o[i])) : ctx.moveTo(tx(i), ty(o[i])));
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let i = 0; i <= iters; i++) {
          ctx.fillStyle = col;
          ctx.fillRect(tx(i) - 1.5, ty(o[i]) - 1.5, 3, 3);
        }
      };
      if (compare) series(orbit2, CYAN);
      series(orbit, ORA);
      if (compare && divergeAt > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(tx(divergeAt), T.y);
        ctx.lineTo(tx(divergeAt), T.y + T.h);
        ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, `diverged at n = ${divergeAt}`, tx(divergeAt) + 4, T.y + 26, { size: 10.5, color: '#fff', font: FONT_MONO });
      }
      text(ctx, `x_n over ${iters} generations${compare ? ` (cyan starts ${delta.toExponential(0)} higher)` : ''}`, T.x + 6, T.y + 13, { size: 10.5, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
    },
    { animate: true },
  );

  // draw the ImageData honouring the device-pixel-ratio transform
  const tmp = useRef<HTMLCanvasElement | null>(null);
  function drawDiagram(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const d = diag.current;
    if (!d.img) return;
    if (!tmp.current) tmp.current = document.createElement('canvas');
    const t = tmp.current;
    if (t.width !== w || t.height !== h) {
      t.width = w;
      t.height = h;
    }
    t.getContext('2d')!.putImageData(d.img, 0, 0);
    ctx.drawImage(t, x, y, w, h);
  }

  usePointer(canvasRef, {
    down: (p) => {
      const el = canvasRef.current!;
      const B = layout(el.clientWidth, el.clientHeight).bif;
      if (p.x < B.x || p.x > B.x + B.w || p.y < B.y || p.y > B.y + B.h) return false;
      dragBox.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, moved: false };
    },
    move: (p, dragging) => {
      const db = dragBox.current;
      if (!dragging || !db) return;
      db.x1 = p.x;
      db.y1 = p.y;
      if (Math.abs(db.x1 - db.x0) + Math.abs(db.y1 - db.y0) > 8) db.moved = true;
      if (!db.moved) return;
    },
    up: () => {
      const db = dragBox.current;
      dragBox.current = null;
      if (!db) return;
      const el = canvasRef.current!;
      const B = layout(el.clientWidth, el.clientHeight).bif;
      const toR = (px: number) => view.r0 + clamp((px - B.x) / B.w, 0, 1) * (view.r1 - view.r0);
      const toX = (py: number) => view.x1 - clamp((py - B.y) / B.h, 0, 1) * (view.x1 - view.x0);
      if (db.moved && Math.abs(db.x1 - db.x0) > 12 && Math.abs(db.y1 - db.y0) > 12) {
        const r0 = toR(Math.min(db.x0, db.x1));
        const r1 = toR(Math.max(db.x0, db.x1));
        const xa = toX(Math.max(db.y0, db.y1));
        const xb = toX(Math.min(db.y0, db.y1));
        setView({ r0, r1, x0: xa, x1: xb });
      } else {
        setSweep(false);
        setR(Number(toR(db.x0).toFixed(5)));
        setCobN(0);
      }
    },
  });

  const reset = () => {
    setSweep(false);
    setR(2.9);
    setX0(0.2);
    setIters(60);
    setCompare(false);
    setDelta(1e-6);
    setView(FULL);
    setCobN(0);
    setPlaying(!reduced);
  };

  const zoomed = view !== FULL;
  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Bifurcation diagram of the logistic map, cobweb plot and time series. Click the diagram to choose r; drag a box to zoom." />}
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setPlaying((p) => !p)} icon={playing ? Icon.pause : Icon.play}>
            {playing ? 'Pause cobweb' : 'Iterate'}
          </Btn>
          <Btn onClick={() => setCobN((n) => Math.min(iters, n + 1))} icon={Icon.step} title="One iteration">
            Step
          </Btn>
          {zoomed && <Btn onClick={() => setView(FULL)}>Reset zoom</Btn>}
        </>
      }
      notice={<Callout tone={lam > 0.01 ? 'event' : 'info'}>{regime(r, lam, period)}</Callout>}
      controls={
        <>
          <ControlGroup title="Parameters">
            <Slider
              label="Growth rate"
              tex="r"
              value={r}
              min={0.5}
              max={4}
              step={0.0005}
              onChange={(v) => {
                setSweep(false);
                setR(v);
                setCobN(0);
              }}
              format={(v) => fix(v, 4)}
              marks={LOGISTIC_LANDMARKS.map((l) => ({ value: l.r, label: l.label }))}
            />
            <Slider label="Fine-tune r" value={r} min={Math.max(0.5, r - 0.01)} max={Math.min(4, r + 0.01)} step={0.00001} onChange={(v) => { setSweep(false); setR(v); }} format={(v) => fix(v, 5)} />
            <Slider label="Starting value" tex="x_0" value={x0} min={0.001} max={0.999} step={0.001} onChange={(v) => { setX0(v); setCobN(0); }} format={(v) => fix(v, 3)} />
            <Slider label="Generations shown" tex="n" value={iters} min={10} max={200} step={1} onChange={(v) => setIters(Math.round(v))} format={(v) => String(Math.round(v))} />
            <div className="btn-row">
              <Btn onClick={() => { setSweep(false); setR(2.8); }}>r = 2.8</Btn>
              <Btn onClick={() => { setSweep(false); setR(3.2); }}>3.2</Btn>
              <Btn onClick={() => { setSweep(false); setR(3.5); }}>3.5</Btn>
              <Btn onClick={() => { setSweep(false); setR(3.835); }}>3.835</Btn>
              <Btn onClick={() => { setSweep(false); setR(3.9); }}>3.9</Btn>
            </div>
          </ControlGroup>
          <ControlGroup title="Sensitivity & structure">
            <Toggle label="Compare a nearby start" checked={compare} onChange={setCompare} />
            {compare && <Slider label="Difference" tex="\delta" value={delta} min={1e-12} max={1e-2} log onChange={setDelta} format={(v) => v.toExponential(0)} />}
            <Toggle label="Lyapunov exponent curve" checked={showLyap} onChange={setShowLyap} />
            <Toggle label="Sweep r automatically" checked={sweep} onChange={(v) => { sweepR.current = r; setSweep(v); }} />
            <p className="responds" style={{ margin: 0 }}>Click the diagram to pick r; drag a rectangle to zoom into its self-similar structure.</p>
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'Lyapunov exponent λ', value: fix(lam, 4), accent: true },
            { label: 'attractor period', value: period ? String(period) : r > 3.5699 ? 'none (chaotic)' : '> 64' },
            { label: 'fixed point 1 − 1/r', value: r > 1 ? fix(1 - 1 / r, 4) : '0' },
            { label: '|f′(x*)| = |2 − r|', value: `${fix(Math.abs(2 - r), 3)} ${Math.abs(2 - r) < 1 ? '(stable)' : '(unstable)'}` },
            { label: `x after ${iters} steps`, value: fix(orbit[iters], 6) },
            { label: 'max |Δx| between starts', value: compare ? fix(maxDiv, 4) : '—' },
          ]}
        />
      }
    />
  );
}
