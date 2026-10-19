import { useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { arrow, dot, FONT_MONO, FONT_SERIF, handle, text } from '../core/draw';
import { abs, arg, expSeriesPartialSums, formatComplex, mul, type Complex } from '../math/complex';
import { clamp, easeInOutCubic, fix } from '../math/rng';

type Mode = 'rotate' | 'product' | 'euler' | 'phasor';
const VIO = '#b48cff';
const PINK = '#ff6fb5';
const CYAN = '#6ff7ff';
const GOLD = '#ffd36e';

const deg = (r: number) => (r * 180) / Math.PI;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function ComplexPlane() {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('rotate');
  const [z, setZ] = useState<Complex>({ re: 1.4, im: 0.6 });
  const [w, setW] = useState<Complex>({ re: 0.8, im: 0.9 });
  const [presses, setPresses] = useState(0);
  const [history, setHistory] = useState<Complex[]>([]);
  const rot = useRef<{ from: number; to: number; start: number; r: number } | null>(null);
  const thetaRef = useRef(0.9);
  const theta = useThrottledValue(() => thetaRef.current, 80);
  const [spin, setSpin] = useState(false);
  const [terms, setTerms] = useState(8);
  const [showSeries, setShowSeries] = useState(true);
  const [amp, setAmp] = useState(1);
  const [freq, setFreq] = useState(0.5);
  const [phase, setPhase] = useState(0);
  const [second, setSecond] = useState(false);
  const [moved, setMoved] = useState({ z: false, w: false });
  const drag = useRef<null | 'z' | 'w' | 'e'>(null);

  useGoalWhen('cx-i4', presses >= 4);
  useGoalWhen('cx-euler', mode === 'euler' && Math.abs(wrapAngle(theta - Math.PI)) < 0.01);
  useGoalWhen('cx-mult', mode === 'product' && moved.z && moved.w);

  const geom = (cw: number, ch: number) => {
    const mob = cw < 700;
    const top = mob ? 110 : 140;
    const phasorMode = mode === 'phasor';
    const areaW = phasorMode ? cw * (mob ? 0.5 : 0.42) : cw;
    const cx = phasorMode ? areaW / 2 + 10 : cw / 2;
    const cy = top + (ch - top - 50) / 2;
    const R = Math.min(areaW, ch - top - 60) / 2;
    const span = mode === 'product' ? 3.2 : mode === 'phasor' ? 2.3 : 2.4;
    const s = R / span;
    return { cx, cy, s, X: (re: number) => cx + re * s, Y: (im: number) => cy - im * s, inv: (px: number, py: number): Complex => ({ re: (px - cx) / s, im: (cy - py) / s }) };
  };

  const timesI = (sign: 1 | -1) => {
    const r = abs(z);
    const a0 = arg(z);
    setHistory((h) => [...h.slice(-6), z]);
    rot.current = { from: a0, to: a0 + (sign * Math.PI) / 2, start: performance.now(), r };
    const nz = sign === 1 ? mul(z, { re: 0, im: 1 }) : mul(z, { re: 0, im: -1 });
    window.setTimeout(() => {
      setZ({ re: Number(nz.re.toFixed(12)), im: Number(nz.im.toFixed(12)) });
      rot.current = null;
    }, reduced ? 0 : 650);
    if (sign === 1) setPresses((p) => p + 1);
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w: cw, h: ch, dt, time }) => {
      ctx.clearRect(0, 0, cw, ch);
      const g = geom(cw, ch);
      if (spin && mode === 'euler') thetaRef.current = (thetaRef.current + dt * 0.8) % (Math.PI * 2);
      drawPlane(ctx, g, cw, ch);
      if (mode === 'rotate') drawRotate(ctx, g);
      else if (mode === 'product') drawProduct(ctx, g);
      else if (mode === 'euler') drawEuler(ctx, g, cw);
      else drawPhasor(ctx, g, cw, ch, time);
    },
    { animate: true },
  );

  type G = ReturnType<typeof geom>;
  function drawPlane(ctx: CanvasRenderingContext2D, g: G, cw: number, ch: number) {
    const ext = 3.4;
    ctx.lineWidth = 1;
    for (let k = -6; k <= 6; k++) {
      ctx.strokeStyle = k === 0 ? 'rgba(200,210,255,0.45)' : 'rgba(150,160,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(g.X(k * 0.5), g.Y(-ext));
      ctx.lineTo(g.X(k * 0.5), g.Y(ext));
      ctx.moveTo(g.X(-ext), g.Y(k * 0.5));
      ctx.lineTo(g.X(ext), g.Y(k * 0.5));
      ctx.stroke();
    }
    // unit circle
    ctx.strokeStyle = 'rgba(180,140,255,0.35)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'Re', g.X(2.3), g.cy - 8, { color: 'rgba(200,210,255,0.7)', size: 12, font: FONT_SERIF, italic: true });
    text(ctx, 'Im', g.cx + 8, g.Y(2.25), { color: 'rgba(200,210,255,0.7)', size: 12, font: FONT_SERIF, italic: true });
    const lbl: [number, number, string][] = [
      [1, 0, '1'],
      [0, 1, 'i'],
      [-1, 0, '−1'],
      [0, -1, '−i'],
    ];
    for (const [re, im, s] of lbl) {
      dot(ctx, g.X(re), g.Y(im), 2.5, 'rgba(220,210,255,0.8)');
      text(ctx, s, g.X(re) + (re === 0 ? 8 : re > 0 ? 6 : -18), g.Y(im) + (im === 0 ? 16 : im > 0 ? -6 : 16), { color: 'rgba(220,210,255,0.85)', size: 13, font: FONT_SERIF, italic: true });
    }
    void cw;
    void ch;
  }

  function vec(ctx: CanvasRenderingContext2D, g: G, c: Complex, col: string, label?: string, width = 2.4) {
    arrow(ctx, g.cx, g.cy, g.X(c.re), g.Y(c.im), col, width, 11, 12);
    if (label) text(ctx, label, g.X(c.re) + 10, g.Y(c.im) - 10, { color: col, size: 15, font: FONT_SERIF, italic: true, shadow: true });
  }

  function angleArc(ctx: CanvasRenderingContext2D, g: G, a0: number, a1: number, rad: number, col: string) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, rad, -a0, -a1, a1 > a0);
    ctx.stroke();
  }

  function drawRotate(ctx: CanvasRenderingContext2D, g: G) {
    history.forEach((hz, i) => {
      const a = (i + 1) / (history.length + 1);
      arrow(ctx, g.cx, g.cy, g.X(hz.re), g.Y(hz.im), `rgba(180,140,255,${0.12 + 0.25 * a})`, 1.4, 8);
    });
    let cur = z;
    if (rot.current) {
      const { from, to, start, r } = rot.current;
      const f = easeInOutCubic((performance.now() - start) / 600);
      const a = from + (to - from) * f;
      cur = { re: r * Math.cos(a), im: r * Math.sin(a) };
      // swept arc
      ctx.save();
      ctx.strokeStyle = PINK;
      ctx.shadowColor = PINK;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, r * g.s, -from, -a, to > from);
      ctx.stroke();
      ctx.restore();
    }
    // circle of radius |z|
    ctx.strokeStyle = 'rgba(255,111,181,0.18)';
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, abs(z) * g.s, 0, Math.PI * 2);
    ctx.stroke();
    vec(ctx, g, cur, VIO, 'z');
    angleArc(ctx, g, 0, arg(cur) < 0 ? arg(cur) + 2 * Math.PI : arg(cur), 26, 'rgba(180,140,255,0.7)');
    handle(ctx, g.X(cur.re), g.Y(cur.im), VIO, drag.current === 'z');
    text(ctx, `× i rotates by 90°   ·   presses: ${presses}   ·   i^${presses} = ${['1', 'i', '−1', '−i'][presses % 4]}`, g.cx, g.Y(-2.15), { align: 'center', color: 'rgba(232,237,251,0.85)', size: 13, font: FONT_MONO });
  }

  function drawProduct(ctx: CanvasRenderingContext2D, g: G) {
    const p = mul(z, w);
    const az = arg(z);
    const aw = arg(w);
    angleArc(ctx, g, 0, az, 30, VIO);
    angleArc(ctx, g, 0, aw, 42, CYAN);
    angleArc(ctx, g, 0, az + aw, 56, PINK);
    // similar triangles: (0, 1, w) ~ (0, z, zw)
    ctx.strokeStyle = 'rgba(111,247,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(g.X(0), g.Y(0));
    ctx.lineTo(g.X(1), g.Y(0));
    ctx.lineTo(g.X(w.re), g.Y(w.im));
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,111,181,0.3)';
    ctx.beginPath();
    ctx.moveTo(g.X(0), g.Y(0));
    ctx.lineTo(g.X(z.re), g.Y(z.im));
    ctx.lineTo(g.X(p.re), g.Y(p.im));
    ctx.closePath();
    ctx.stroke();
    vec(ctx, g, z, VIO, 'z');
    vec(ctx, g, w, CYAN, 'w');
    vec(ctx, g, p, PINK, 'zw', 2.8);
    handle(ctx, g.X(z.re), g.Y(z.im), VIO, drag.current === 'z');
    handle(ctx, g.X(w.re), g.Y(w.im), CYAN, drag.current === 'w');
  }

  function drawEuler(ctx: CanvasRenderingContext2D, g: G, cw: number) {
    const th = thetaRef.current;
    const e: Complex = { re: Math.cos(th), im: Math.sin(th) };
    // projections
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(111,247,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(g.X(e.re), g.Y(e.im));
    ctx.lineTo(g.X(e.re), g.Y(0));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,211,110,0.6)';
    ctx.beginPath();
    ctx.moveTo(g.X(e.re), g.Y(e.im));
    ctx.lineTo(g.X(0), g.Y(e.im));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(g.X(0), g.Y(0) + 0.5);
    ctx.lineTo(g.X(e.re), g.Y(0) + 0.5);
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(g.X(0) - 0.5, g.Y(0));
    ctx.lineTo(g.X(0) - 0.5, g.Y(e.im));
    ctx.stroke();
    angleArc(ctx, g, 0, th, 30, 'rgba(255,255,255,0.6)');
    // series spiral: partial sums of Σ (iθ)^n / n!
    if (showSeries) {
      const sums = expSeriesPartialSums({ re: 0, im: th }, terms);
      ctx.save();
      ctx.strokeStyle = PINK;
      ctx.shadowColor = PINK;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(g.X(0), g.Y(0));
      sums.forEach((s) => ctx.lineTo(g.X(s.re), g.Y(s.im)));
      ctx.stroke();
      ctx.restore();
      sums.forEach((s, i) => dot(ctx, g.X(s.re), g.Y(s.im), i === sums.length - 1 ? 4 : 2.2, PINK));
    }
    vec(ctx, g, e, VIO, '');
    dot(ctx, g.X(e.re), g.Y(e.im), 6, '#fff', 14);
    text(ctx, `e^{iθ}`, g.X(e.re) + 10, g.Y(e.im) - 10, { color: VIO, size: 15, font: FONT_MONO, shadow: true });
    text(ctx, `cos θ = ${fix(e.re, 3)}`, g.X(e.re / 2), g.Y(0) + 20, { align: 'center', color: CYAN, size: 12, font: FONT_MONO, shadow: true });
    text(ctx, `sin θ = ${fix(e.im, 3)}`, g.X(0) - 8, g.Y(e.im / 2), { align: 'right', color: GOLD, size: 12, font: FONT_MONO, shadow: true });
    if (Math.abs(wrapAngle(th - Math.PI)) < 0.02)
      text(ctx, 'e^{iπ} = −1   ⇒   e^{iπ} + 1 = 0', cw / 2, g.Y(-2.1), { align: 'center', color: '#fff', size: 16, font: FONT_MONO, shadow: true });
    handle(ctx, g.X(e.re), g.Y(e.im), VIO, drag.current === 'e');
  }

  function drawPhasor(ctx: CanvasRenderingContext2D, g: G, cw: number, ch: number, time: number) {
    const om = 2 * Math.PI * freq;
    const t = reduced ? 0 : time;
    const p1: Complex = { re: amp * Math.cos(om * t + phase), im: amp * Math.sin(om * t + phase) };
    const p2: Complex = second ? { re: 0.6 * Math.cos(2 * om * t + 1), im: 0.6 * Math.sin(2 * om * t + 1) } : { re: 0, im: 0 };
    const sum: Complex = { re: p1.re + p2.re, im: p1.im + p2.im };
    arrow(ctx, g.cx, g.cy, g.X(p1.re), g.Y(p1.im), VIO, 2.4, 10, 10);
    if (second) arrow(ctx, g.X(p1.re), g.Y(p1.im), g.X(sum.re), g.Y(sum.im), CYAN, 2, 9, 8);
    dot(ctx, g.X(sum.re), g.Y(sum.im), 5, '#fff', 12);
    // time trace of the real part (cosine) to the right
    const x0 = g.cx + 2.4 * g.s + 30;
    const x1 = cw - 30;
    ctx.strokeStyle = 'rgba(200,210,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(x0, g.cy);
    ctx.lineTo(x1, g.cy);
    ctx.stroke();
    // horizontal projection line
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(g.X(sum.re), g.Y(sum.im));
    ctx.lineTo(x0, g.Y(sum.im));
    ctx.stroke();
    ctx.setLineDash([]);
    // trace: imaginary part plotted vertically (so the projection lines up) against time to the right
    ctx.save();
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const span = 3; // seconds shown
    for (let i = 0; i <= 300; i++) {
      const tt = t - (i / 300) * span;
      const v = amp * Math.sin(om * tt + phase) + (second ? 0.6 * Math.sin(2 * om * tt + 1) : 0);
      const x = x0 + (i / 300) * (x1 - x0);
      if (i) ctx.lineTo(x, g.Y(v));
      else ctx.moveTo(x, g.Y(v));
    }
    ctx.stroke();
    ctx.restore();
    text(ctx, 'Im part over time → a sinusoid', x0, g.Y(2.1), { color: 'rgba(232,237,251,0.75)', size: 12, font: FONT_SERIF, italic: true });
    text(ctx, `A sin(ωt + φ), ω = ${fix(om, 2)} rad/s`, x0, g.Y(-2.15), { color: 'rgba(255,111,181,0.85)', size: 12, font: FONT_MONO });
    void ch;
  }

  usePointer(canvasRef, {
    down: (p) => {
      const g = geom(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
      const near = (c: Complex) => Math.hypot(p.x - g.X(c.re), p.y - g.Y(c.im)) < 28;
      if ((mode === 'rotate' || mode === 'product') && near(z)) drag.current = 'z';
      else if (mode === 'product' && near(w)) drag.current = 'w';
      else if (mode === 'euler') {
        drag.current = 'e';
        setSpin(false);
        const c = g.inv(p.x, p.y);
        thetaRef.current = (Math.atan2(c.im, c.re) + 2 * Math.PI) % (2 * Math.PI);
      } else return false;
    },
    move: (p, dragging) => {
      if (!dragging || !drag.current) return;
      const g = geom(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
      const c = g.inv(p.x, p.y);
      const snap = (v: number) => (Math.abs(v - Math.round(v * 2) / 2) < 0.06 ? Math.round(v * 2) / 2 : v);
      const cc = { re: clamp(snap(c.re), -2.6, 2.6), im: clamp(snap(c.im), -2.6, 2.6) };
      if (drag.current === 'z') {
        setZ(cc);
        setMoved((m) => ({ ...m, z: true }));
        setPresses(0);
        setHistory([]);
      } else if (drag.current === 'w') {
        setW(cc);
        setMoved((m) => ({ ...m, w: true }));
      } else if (drag.current === 'e') {
        let a = (Math.atan2(c.im, c.re) + 2 * Math.PI) % (2 * Math.PI);
        if (Math.abs(a - Math.PI) < 0.04) a = Math.PI;
        thetaRef.current = a;
      }
    },
    up: () => {
      drag.current = null;
    },
  });

  const reset = () => {
    setZ({ re: 1.4, im: 0.6 });
    setW({ re: 0.8, im: 0.9 });
    setPresses(0);
    setHistory([]);
    thetaRef.current = 0.9;
    setSpin(false);
    setTerms(8);
    setAmp(1);
    setFreq(0.5);
    setPhase(0);
    setSecond(false);
  };

  const prod = mul(z, w);
  const eTh: Complex = { re: Math.cos(theta), im: Math.sin(theta) };
  const series = expSeriesPartialSums({ re: 0, im: theta }, terms);
  const last = series[series.length - 1];

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="The complex plane with draggable complex numbers" />}
      onReset={reset}
      toolbar={
        mode === 'rotate' ? (
          <>
            <Btn variant="primary" onClick={() => timesI(1)}>× i</Btn>
            <Btn onClick={() => timesI(-1)}>× (−i)</Btn>
          </>
        ) : mode === 'euler' ? (
          <>
            <Btn onClick={() => setSpin((s) => !s)} icon={spin ? Icon.pause : Icon.play}>
              {spin ? 'Pause' : 'Spin θ'}
            </Btn>
            <Btn variant="primary" onClick={() => { setSpin(false); thetaRef.current = Math.PI; }}>θ = π</Btn>
          </>
        ) : null
      }
      notice={
        mode === 'rotate' && presses > 0 && presses % 4 === 0 ? (
          <Callout tone="success">
            Four quarter-turns make a full turn: <strong>i⁴ = 1</strong>. Two make a half-turn: <strong>i² = −1</strong>.
          </Callout>
        ) : mode === 'rotate' && presses % 4 === 2 ? (
          <Callout tone="event">
            Two presses: z · i · i = −z. That is exactly what <strong>i² = −1</strong> means.
          </Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="Experiment"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'rotate', label: '× i rotation' },
              { value: 'product', label: 'z × w' },
              { value: 'euler', label: 'Euler’s formula' },
              { value: 'phasor', label: 'Phasors (AC)' },
            ]}
          />
          {mode === 'rotate' && <p className="responds" style={{ margin: 0 }}>Drag z anywhere, then multiply by i. Watch its length stay fixed while it turns a right angle.</p>}
          {mode === 'product' && <p className="responds" style={{ margin: 0 }}>Drag z and w. The product’s length is |z||w| and its angle is arg z + arg w. The two outlined triangles are always similar.</p>}
          {mode === 'euler' && (
            <ControlGroup title="Angle">
              <Slider
                label="Angle"
                tex="\theta"
                value={theta}
                min={0}
                max={2 * Math.PI}
                step={0.001}
                onChange={(v) => {
                  setSpin(false);
                  thetaRef.current = Math.abs(v - Math.PI) < 0.01 ? Math.PI : v;
                }}
                format={(v) => `${fix(v, 3)} rad (${fix(deg(v), 1)}°)`}
                marks={[{ value: Math.PI, label: 'π' }]}
              />
              <Toggle label="Series partial sums" checked={showSeries} onChange={setShowSeries} tip="e^{iθ} = 1 + iθ + (iθ)²/2! + … Each term turns 90° from the last." />
              <Slider label="Series terms" value={terms} min={1} max={24} step={1} onChange={(v) => setTerms(Math.round(v))} format={(v) => String(Math.round(v))} />
            </ControlGroup>
          )}
          {mode === 'phasor' && (
            <ControlGroup title="Phasor">
              <Slider label="Amplitude" tex="A" value={amp} min={0.2} max={1.6} step={0.01} onChange={setAmp} format={(v) => fix(v, 2)} />
              <Slider label="Frequency" tex="f" value={freq} min={0.1} max={1.5} step={0.01} onChange={setFreq} format={(v) => fix(v, 2)} unit="Hz" />
              <Slider label="Phase" tex="\varphi" value={phase} min={-Math.PI} max={Math.PI} step={0.01} onChange={setPhase} format={(v) => `${fix(deg(v), 0)}°`} />
              <Toggle label="Add a second harmonic phasor" checked={second} onChange={setSecond} tip="Adding phasors tip-to-tail adds their sinusoids — how engineers combine AC voltages." />
            </ControlGroup>
          )}
        </>
      }
      readouts={
        mode === 'euler' ? (
          <Readouts
            items={[
              { label: 'e^{iθ}', value: formatComplex(eTh, 4), accent: true },
              { label: `series, ${terms} terms`, value: formatComplex(last, 4) },
              { label: 'series error', value: Math.hypot(last.re - eTh.re, last.im - eTh.im).toExponential(2) },
              { label: '|e^{iθ}|', value: fix(Math.hypot(eTh.re, eTh.im), 6) },
            ]}
          />
        ) : mode === 'product' ? (
          <Readouts
            items={[
              { label: 'z', value: formatComplex(z) },
              { label: 'w', value: formatComplex(w) },
              { label: 'z × w', value: formatComplex(prod), accent: true },
              { label: '|z|·|w|', value: `${fix(abs(z), 3)} × ${fix(abs(w), 3)} = ${fix(abs(z) * abs(w), 3)}` },
              { label: '|zw|', value: fix(abs(prod), 3) },
              { label: 'arg z + arg w', value: `${fix(deg(arg(z)), 1)}° + ${fix(deg(arg(w)), 1)}°` },
              { label: 'arg(zw)', value: `${fix(deg(wrapAngle(arg(z) + arg(w))), 1)}°`, accent: true },
            ]}
          />
        ) : mode === 'rotate' ? (
          <Readouts
            items={[
              { label: 'z', value: formatComplex(z), accent: true },
              { label: '|z|', value: fix(abs(z), 4) },
              { label: 'arg z', value: `${fix(deg(arg(z)), 1)}°` },
              { label: 'i · i', value: formatComplex(mul({ re: 0, im: 1 }, { re: 0, im: 1 }), 0) },
            ]}
          />
        ) : (
          <Readouts
            items={[
              { label: 'ω = 2πf', value: `${fix(2 * Math.PI * freq, 3)} rad/s` },
              { label: 'period', value: `${fix(1 / freq, 3)} s` },
              { label: 'phasor', value: `${fix(amp, 2)} ∠ ${fix(deg(phase), 0)}°`, accent: true },
              { label: 'traced signal (Im part)', value: 'A sin(ωt + φ)' },
            ]}
          />
        )
      }
    />
  );
}
