import { useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { axes, FONT_MONO, FONT_SERIF, handle, mapper, text, type Mapper } from '../core/draw';
import { centralDiff, exactIntegral, FUNCTIONS, naturalSpline, riemann, simpson, type RealFn, type RiemannRule } from '../math/calculus';
import { clamp, fix } from '../math/rng';

const CYAN = '#4fe3ff';
const MAG = '#ff5fd2';
const YEL = '#f8f871';

export default function Calculus() {
  const reduced = useReducedMotion();
  const [fnId, setFnId] = useState('wave');
  const [drawn, setDrawn] = useState<RealFn | null>(null);
  const [h, setH] = useState(1.2);
  const [showSecant, setShowSecant] = useState(true);
  const [showTangent, setShowTangent] = useState(true);
  const [showRiemann, setShowRiemann] = useState(true);
  const [n, setN] = useState(8);
  const [rule, setRule] = useState<RiemannRule>('midpoint');
  const [lower, setLower] = useState<'derivative' | 'integral'>('derivative');
  const [playing, setPlaying] = useState(!reduced);
  const x0Ref = useRef(1.2);
  const x0 = useThrottledValue(() => x0Ref.current, 80);
  const [bounds, setBounds] = useState<[number, number]>([0.5, 4.5]);
  const [drawMode, setDrawMode] = useState(false);
  const strokeRef = useRef<[number, number][]>([]);
  const drag = useRef<null | 'x0' | 'a' | 'b' | 'draw'>(null);
  const dir = useRef(1);

  const fn: RealFn = fnId === 'draw' && drawn ? drawn : FUNCTIONS.find((f) => f.id === fnId) ?? FUNCTIONS[0];
  const [d0, d1] = fn.domain;
  const a = clamp(Math.min(bounds[0], bounds[1]), d0, d1);
  const b = clamp(Math.max(bounds[0], bounds[1]), d0, d1);
  const df = (x: number) => (fn.df ? fn.df(x) : centralDiff(fn.f, x, 1e-4));
  const exact = useMemo(() => exactIntegral(fn, a, b), [fn, a, b]);
  const approx = riemann(fn.f, a, b, n, rule);
  const xx = clamp(x0, d0, d1);
  const secant = (fn.f(xx + h) - fn.f(xx)) / h;
  const slope = df(xx);

  useGoalWhen('calc-h', showSecant && h < 0.01);
  useGoalWhen('calc-zero', Math.abs(slope) < 0.02 && !playing);
  useGoalWhen('calc-riemann', showRiemann && n >= 100);
  useGoalWhen('calc-draw', !!drawn && fnId === 'draw');

  // precomputed integral curve F(x) = ∫_a^x f for the lower plot
  const integralCurve = useMemo(() => {
    const N = 400;
    const xs = new Float64Array(N);
    const Fs = new Float64Array(N);
    let acc = 0;
    const step = (d1 - d0) / (N - 1);
    // integrate from a; values left of a are negative areas
    const ia = Math.round((a - d0) / step);
    for (let i = 0; i < N; i++) xs[i] = d0 + i * step;
    Fs[ia] = 0;
    acc = 0;
    for (let i = ia + 1; i < N; i++) {
      acc += simpson(fn.f, xs[i - 1], xs[i], 4);
      Fs[i] = acc;
    }
    acc = 0;
    for (let i = ia - 1; i >= 0; i--) {
      acc -= simpson(fn.f, xs[i], xs[i + 1], 4);
      Fs[i] = acc;
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of Fs) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return { xs, Fs, lo, hi };
  }, [fn, a, d0, d1]);

  const derivRange = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const v = df(d0 + ((d1 - d0) * i) / 200);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const pad = (hi - lo) * 0.15 + 0.2;
    return [lo - pad, hi + pad] as [number, number];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  const layout = (w: number, H: number) => {
    const mob = w < 700;
    const top = mob ? 118 : 150;
    const left = mob ? 34 : 56;
    const right = 22;
    const bottom = 64;
    const total = H - top - bottom;
    const upperH = total * 0.62;
    const gap = 30;
    const upper = mapper({ x: left, y: top, w: w - left - right, h: upperH }, [d0, d1], fn.range);
    const lowerRange = lower === 'derivative' ? derivRange : ([Math.min(integralCurve.lo, -0.2) * 1.15, Math.max(integralCurve.hi, 0.2) * 1.15] as [number, number]);
    const lowerM = mapper({ x: left, y: top + upperH + gap, w: w - left - right, h: total - upperH - gap }, [d0, d1], lowerRange);
    return { upper, lowerM };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h: H, dt }) => {
      ctx.clearRect(0, 0, w, H);
      if (playing && !drag.current) {
        let x = x0Ref.current + dir.current * dt * 0.55;
        if (x > d1 - 0.05) {
          x = d1 - 0.05;
          dir.current = -1;
        }
        if (x < d0 + 0.05) {
          x = d0 + 0.05;
          dir.current = 1;
        }
        x0Ref.current = x;
      }
      const X0 = clamp(x0Ref.current, d0, d1);
      const { upper: m, lowerM } = layout(w, H);
      axes(ctx, m, { xLabel: 'x', yLabel: 'f(x)' });
      // Riemann rectangles
      if (showRiemann) {
        const dx = (b - a) / n;
        for (let i = 0; i < n; i++) {
          const xl = a + i * dx;
          const xr = xl + dx;
          if (rule === 'trapezoid') {
            ctx.beginPath();
            ctx.moveTo(m.X(xl), m.Y(0));
            ctx.lineTo(m.X(xl), m.Y(fn.f(xl)));
            ctx.lineTo(m.X(xr), m.Y(fn.f(xr)));
            ctx.lineTo(m.X(xr), m.Y(0));
            ctx.closePath();
          } else {
            const xs = rule === 'left' ? xl : rule === 'right' ? xr : xl + dx / 2;
            const y = fn.f(xs);
            ctx.beginPath();
            ctx.rect(m.X(xl), Math.min(m.Y(0), m.Y(y)), m.X(xr) - m.X(xl), Math.abs(m.Y(y) - m.Y(0)));
          }
          const y = fn.f(xl + dx / 2);
          ctx.fillStyle = y >= 0 ? 'rgba(79,227,255,0.16)' : 'rgba(255,95,210,0.16)';
          ctx.fill();
          if (n <= 80) {
            ctx.strokeStyle = y >= 0 ? 'rgba(79,227,255,0.55)' : 'rgba(255,95,210,0.55)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        // exact area glow
        ctx.beginPath();
        ctx.moveTo(m.X(a), m.Y(0));
        for (let i = 0; i <= 200; i++) {
          const x = a + ((b - a) * i) / 200;
          ctx.lineTo(m.X(x), m.Y(fn.f(x)));
        }
        ctx.lineTo(m.X(b), m.Y(0));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, m.rect.y, 0, m.rect.y + m.rect.h);
        g.addColorStop(0, 'rgba(79,227,255,0.10)');
        g.addColorStop(1, 'rgba(255,95,210,0.06)');
        ctx.fillStyle = g;
        ctx.fill();
        for (const xb of [a, b]) {
          ctx.strokeStyle = 'rgba(248,248,113,0.6)';
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(m.X(xb), m.rect.y);
          ctx.lineTo(m.X(xb), m.rect.y + m.rect.h);
          ctx.stroke();
          ctx.setLineDash([]);
          handle(ctx, m.X(xb), m.Y(0), YEL, drag.current === (xb === a ? 'a' : 'b'));
        }
        text(ctx, 'a', m.X(a) - 10, m.Y(0) + 22, { color: YEL, font: FONT_SERIF, italic: true, size: 15 });
        text(ctx, 'b', m.X(b) + 6, m.Y(0) + 22, { color: YEL, font: FONT_SERIF, italic: true, size: 15 });
      }
      // the curve
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) {
        const x = d0 + ((d1 - d0) * i) / 400;
        const y = fn.f(x);
        if (i) ctx.lineTo(m.X(x), m.Y(y));
        else ctx.moveTo(m.X(x), m.Y(y));
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
      // drawing stroke preview
      if (drag.current === 'draw' && strokeRef.current.length > 1) {
        ctx.beginPath();
        strokeRef.current.forEach(([x, y], i) => (i ? ctx.lineTo(m.X(x), m.Y(y)) : ctx.moveTo(m.X(x), m.Y(y))));
        ctx.strokeStyle = MAG;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const y0 = fn.f(X0);
      const s0 = df(X0);
      // secant
      if (showSecant) {
        const x2 = X0 + h;
        const y2 = fn.f(x2);
        const sl = (y2 - y0) / h;
        const L = (d1 - d0) * 0.6;
        ctx.strokeStyle = 'rgba(255,95,210,0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.X(X0 - L), m.Y(y0 - sl * L));
        ctx.lineTo(m.X(X0 + L), m.Y(y0 + sl * L));
        ctx.stroke();
        ctx.fillStyle = MAG;
        ctx.beginPath();
        ctx.arc(m.X(x2), m.Y(y2), 4.5, 0, Math.PI * 2);
        ctx.fill();
        // rise/run
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(m.X(X0), m.Y(y0));
        ctx.lineTo(m.X(x2), m.Y(y0));
        ctx.lineTo(m.X(x2), m.Y(y2));
        ctx.stroke();
        ctx.setLineDash([]);
        if (h > 0.25) text(ctx, 'h', (m.X(X0) + m.X(x2)) / 2, m.Y(y0) + (y2 > y0 ? 14 : -6), { align: 'center', color: MAG, font: FONT_SERIF, italic: true, size: 14 });
      }
      // tangent
      if (showTangent) {
        const L = (d1 - d0) * 0.22;
        ctx.save();
        ctx.strokeStyle = CYAN;
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(m.X(X0 - L), m.Y(y0 - s0 * L));
        ctx.lineTo(m.X(X0 + L), m.Y(y0 + s0 * L));
        ctx.stroke();
        ctx.restore();
      }
      handle(ctx, m.X(X0), m.Y(y0), CYAN, drag.current === 'x0');
      text(ctx, `slope ${fix(s0, 3)}`, m.X(X0) + 14, m.Y(y0) - 14, { color: CYAN, font: FONT_MONO, size: 12, shadow: true });

      // lower plot
      axes(ctx, lowerM, { xLabel: 'x', yLabel: lower === 'derivative' ? "f′(x)" : 'F(x) = ∫ₐˣ f dt', labels: true });
      if (lower === 'derivative') {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
          const x = d0 + ((d1 - d0) * i) / 300;
          const v = df(x);
          if (i) ctx.lineTo(lowerM.X(x), lowerM.Y(v));
          else ctx.moveTo(lowerM.X(x), lowerM.Y(v));
        }
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 2;
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
        connector(ctx, m, lowerM, X0, y0, s0);
        handle(ctx, lowerM.X(X0), lowerM.Y(s0), CYAN, false);
      } else {
        const { xs, Fs } = integralCurve;
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < xs.length; i++) (i ? ctx.lineTo(lowerM.X(xs[i]), lowerM.Y(Fs[i])) : ctx.moveTo(lowerM.X(xs[i]), lowerM.Y(Fs[i])));
        ctx.strokeStyle = YEL;
        ctx.lineWidth = 2;
        ctx.shadowColor = YEL;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
        // tangent on F at x0 has slope f(x0): FTC
        const Fx = interp(xs, Fs, X0);
        const L = (d1 - d0) * 0.12;
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(lowerM.X(X0 - L), lowerM.Y(Fx - y0 * L));
        ctx.lineTo(lowerM.X(X0 + L), lowerM.Y(Fx + y0 * L));
        ctx.stroke();
        connector(ctx, m, lowerM, X0, y0, Fx);
        handle(ctx, lowerM.X(X0), lowerM.Y(Fx), YEL, false);
        text(ctx, `slope of F = f(x) = ${fix(y0, 3)}`, lowerM.X(X0) + 14, lowerM.Y(Fx) - 12, { color: YEL, font: FONT_MONO, size: 11, shadow: true });
      }
      if (drawMode) text(ctx, 'Draw a curve from left to right across the upper plot', w / 2, m.rect.y + 18, { align: 'center', color: MAG, size: 14, font: FONT_SERIF, italic: true });
    },
    { animate: true },
  );

  usePointer(canvasRef, {
    down: (p) => {
      const el = canvasRef.current!;
      const { upper: m } = layout(el.clientWidth, el.clientHeight);
      if (drawMode && p.y > m.rect.y && p.y < m.rect.y + m.rect.h) {
        drag.current = 'draw';
        strokeRef.current = [[m.invX(p.x), m.invY(p.y)]];
        return;
      }
      const X0 = clamp(x0Ref.current, d0, d1);
      const cands: ['x0' | 'a' | 'b', number, number][] = [['x0', m.X(X0), m.Y(fn.f(X0))]];
      if (showRiemann) cands.push(['a', m.X(a), m.Y(0)], ['b', m.X(b), m.Y(0)]);
      let best: 'x0' | 'a' | 'b' | null = null;
      let bd = 30;
      for (const [k, x, y] of cands) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (!best) {
        // click on the curve area moves the point
        if (p.y > m.rect.y && p.y < m.rect.y + m.rect.h) {
          drag.current = 'x0';
          x0Ref.current = clamp(m.invX(p.x), d0, d1);
          setPlaying(false);
          return;
        }
        return false;
      }
      drag.current = best;
      if (best === 'x0') setPlaying(false);
    },
    move: (p, dragging) => {
      const el = canvasRef.current!;
      const { upper: m } = layout(el.clientWidth, el.clientHeight);
      if (!dragging) return;
      const x = clamp(m.invX(p.x), d0, d1);
      if (drag.current === 'x0') x0Ref.current = x;
      else if (drag.current === 'a') setBounds(([, bb]) => [x, bb]);
      else if (drag.current === 'b') setBounds(([aa]) => [aa, x]);
      else if (drag.current === 'draw') {
        const pts = strokeRef.current;
        const y = clamp(m.invY(p.y), fn.range[0], fn.range[1]);
        if (x > pts[pts.length - 1][0] + 0.02) pts.push([x, y]);
      }
    },
    up: () => {
      if (drag.current === 'draw') finishDrawing();
      drag.current = null;
    },
  });

  function finishDrawing() {
    const pts = strokeRef.current;
    if (pts.length < 6) return;
    // resample to ~30 knots for a smooth natural spline
    const xs: number[] = [];
    const ys: number[] = [];
    const K = Math.min(30, pts.length);
    for (let i = 0; i < K; i++) {
      const p = pts[Math.round((i / (K - 1)) * (pts.length - 1))];
      if (xs.length && p[0] <= xs[xs.length - 1]) continue;
      xs.push(p[0]);
      ys.push(p[1]);
    }
    const s = naturalSpline(xs, ys);
    const lo = xs[0];
    const hi = xs[xs.length - 1];
    const f = (x: number) => s(clamp(x, lo, hi));
    setDrawn({ id: 'draw', label: 'Your curve', tex: 'f(x) = \\text{your curve}', f, domain: [-4, 4], range: [-3, 3] });
    setDrawMode(false);
    setFnId('draw');
    setBounds([Math.max(lo, -2.5), Math.min(hi, 2.5)]);
    x0Ref.current = clamp(0, lo, hi);
  }

  const reset = () => {
    setFnId('wave');
    setH(1.2);
    setN(8);
    setRule('midpoint');
    setBounds([0.5, 4.5]);
    x0Ref.current = 1.2;
    setShowSecant(true);
    setShowTangent(true);
    setShowRiemann(true);
    setDrawMode(false);
    setPlaying(!reduced);
  };

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Function plot with tangent line, secant line and Riemann rectangles; lower plot shows the derivative or the accumulated integral." />}
      onReset={reset}
      toolbar={
        <Btn onClick={() => setPlaying((p) => !p)} icon={playing ? Icon.pause : Icon.play} title={playing ? 'Pause the moving point' : 'Move the point along the curve'}>
          {playing ? 'Pause' : 'Play'}
        </Btn>
      }
      legend={
        <>
          <span className="legend-item"><i className="legend-swatch" style={{ background: CYAN }} /> tangent (instantaneous)</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: MAG }} /> secant (average over h)</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: YEL }} /> integral bounds</span>
        </>
      }
      notice={
        Math.abs(slope) < 0.02 ? (
          <Callout tone="event">
            <strong>Stationary point.</strong> The tangent is horizontal: f′(x) ≈ 0 at x = {fix(xx, 3)}.
          </Callout>
        ) : showSecant && h < 0.01 ? (
          <Callout tone="event">
            With h = {h.toPrecision(2)}, the secant slope {fix(secant, 4)} is within {Math.abs(secant - slope).toExponential(1)} of the derivative.
          </Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="Function"
            value={drawMode ? 'draw' : fnId}
            onChange={(v) => {
              if (v === 'draw') {
                setDrawMode(true);
                setPlaying(false);
              } else {
                setDrawMode(false);
                setFnId(v);
                const f = FUNCTIONS.find((q) => q.id === v)!;
                const span = f.domain[1] - f.domain[0];
                setBounds([f.domain[0] + span * 0.2, f.domain[0] + span * 0.75]);
                x0Ref.current = f.domain[0] + span * 0.35;
              }
            }}
            options={[...FUNCTIONS.map((f) => ({ value: f.id, label: f.label })), { value: 'draw', label: drawn ? 'Your curve ✎' : 'Draw ✎' }]}
          />
          <ControlGroup title="Derivative">
            <Slider
              label="Point"
              tex="x"
              value={xx}
              min={d0}
              max={d1}
              onChange={(v) => {
                setPlaying(false);
                x0Ref.current = v;
              }}
              format={(v) => fix(v, 3)}
            />
            <Slider label="Secant step" tex="h" value={h} min={0.001} max={2} log onChange={setH} format={(v) => (v < 0.01 ? v.toExponential(1) : fix(v, 3))} tip="The secant uses two points h apart. As h → 0 its slope becomes the derivative." />
            <div className="toggle-row">
              <Toggle label="Tangent" checked={showTangent} onChange={setShowTangent} />
              <Toggle label="Secant" checked={showSecant} onChange={setShowSecant} />
            </div>
          </ControlGroup>
          <ControlGroup title="Integral">
            <Toggle label="Riemann rectangles" checked={showRiemann} onChange={setShowRiemann} />
            <Slider label="Rectangles" tex="n" value={n} min={1} max={400} step={1} log onChange={(v) => setN(Math.round(v))} format={(v) => String(Math.round(v))} />
            <Segmented
              small
              value={rule}
              onChange={setRule}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'midpoint', label: 'Midpoint' },
                { value: 'right', label: 'Right' },
                { value: 'trapezoid', label: 'Trapezoid' },
              ]}
            />
            <Segmented
              label="Lower plot"
              value={lower}
              onChange={setLower}
              options={[
                { value: 'derivative', label: 'Derivative f′(x)' },
                { value: 'integral', label: 'Accumulated area F(x)' },
              ]}
            />
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'f(x)', value: fix(fn.f(xx), 4) },
            { label: "f′(x) instantaneous", value: fix(slope, 4), accent: true },
            { label: 'secant (average) slope', value: fix(secant, 4) },
            { label: 'secant − tangent', value: fix(secant - slope, 4) },
            { label: `Riemann sum, n = ${n}`, value: fix(approx, 5) },
            { label: `exact ∫ from ${fix(a, 2)} to ${fix(b, 2)}`, value: fix(exact, 5), accent: true },
            { label: 'error', value: Math.abs(approx - exact) < 1e-6 ? (approx - exact).toExponential(1) : fix(approx - exact, 5) },
            { label: 'function', value: fn.label },
          ]}
        />
      }
    />
  );
}

function connector(ctx: CanvasRenderingContext2D, m: Mapper, lm: Mapper, x: number, y: number, ly: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(m.X(x), m.Y(y));
  ctx.lineTo(lm.X(x), lm.Y(ly));
  ctx.stroke();
  ctx.setLineDash([]);
}

function interp(xs: Float64Array, ys: Float64Array, x: number) {
  const n = xs.length;
  const t = ((x - xs[0]) / (xs[n - 1] - xs[0])) * (n - 1);
  const i = clamp(Math.floor(t), 0, n - 2);
  const f = t - i;
  return ys[i] * (1 - f) + ys[i + 1] * f;
}
