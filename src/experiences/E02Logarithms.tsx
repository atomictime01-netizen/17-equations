import { useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { FONT_MONO, FONT_SERIF, text } from '../core/draw';
import { clamp, fix, fmt, sci, smoothstep } from '../math/rng';

type View = 'ruler' | 'slide' | 'magnitudes';
type Base = '10' | '2' | 'e';
const GOLD = '#ffd36e';
const TEAL = '#57f2c7';
const PINK = '#ff7ab6';
const BLUE = '#7c9cff';

const DISTANCES = [
  { v: 1.7e-15, label: 'Proton' },
  { v: 1.06e-10, label: 'Hydrogen atom' },
  { v: 1e-7, label: 'Virus' },
  { v: 8e-6, label: 'Red blood cell' },
  { v: 7e-5, label: 'Width of a hair' },
  { v: 1.7, label: 'Human' },
  { v: 8.849e3, label: 'Everest' },
  { v: 1.2742e7, label: 'Earth' },
  { v: 3.844e8, label: 'Earth–Moon' },
  { v: 1.496e11, label: 'Earth–Sun (1 AU)' },
  { v: 9.461e15, label: 'Light-year' },
  { v: 4.0e16, label: 'Proxima Centauri' },
  { v: 9.5e20, label: 'Milky Way' },
  { v: 2.4e22, label: 'Andromeda' },
  { v: 8.8e26, label: 'Observable universe' },
];
const SOUNDS = [
  { v: 1e-12, label: 'Threshold of hearing' },
  { v: 1e-10, label: 'Rustling leaves' },
  { v: 1e-9, label: 'Whisper' },
  { v: 1e-6, label: 'Conversation' },
  { v: 1e-4, label: 'Busy traffic' },
  { v: 1e-2, label: 'Power tools' },
  { v: 1e-1, label: 'Rock concert' },
  { v: 10, label: 'Threshold of pain' },
  { v: 1e2, label: 'Jet engine at 30 m' },
];

export default function Logarithms() {
  const reduced = useReducedMotion();
  const [view, setView] = useState<View>('ruler');
  const [a, setA] = useState(3);
  const [b, setB] = useState(25);
  const [base, setBase] = useState<Base>('10');
  const morphRef = useRef(reduced ? 1 : 0);
  const morph = useThrottledValue(() => morphRef.current, 90);
  const setMorph = (v: number) => {
    morphRef.current = v;
  };
  const [autoMorph, setAutoMorph] = useState(!reduced);
  const slideRef = useRef(0); // 0..1 of log10(a mantissa)
  const setSlide = (v: number | ((s: number) => number)) => {
    slideRef.current = typeof v === 'function' ? v(slideRef.current) : v;
  };
  const [slideUsed, setSlideUsed] = useState(false);
  const [scaleKind, setScaleKind] = useState<'distance' | 'sound'>('distance');
  const [cursor, setCursor] = useState(0.5);
  const dragging = useRef<null | 'slide' | 'cursor'>(null);

  const lb = base === '10' ? Math.log(10) : base === '2' ? Math.log(2) : 1;
  const log = (x: number) => Math.log(x) / lb;
  const baseLabel = base === 'e' ? 'ln' : `log${base === '10' ? '₁₀' : '₂'}`;
  const ab = a * b;

  useGoalWhen('log-product', Math.abs(a - 8) < 0.05 && Math.abs(b - 16) < 0.08);
  useGoalWhen('log-base', base === '2');
  useGoalWhen('log-slide', view === 'slide' && slideUsed);
  useGoalWhen('log-span', view === 'magnitudes');

  // slide-rule mantissas
  const ma = a / Math.pow(10, Math.floor(Math.log10(a)));
  const mb = b / Math.pow(10, Math.floor(Math.log10(b)));
  const ea = Math.floor(Math.log10(a));
  const eb = Math.floor(Math.log10(b));

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt, time }) => {
      ctx.clearRect(0, 0, w, h);
      const mob = w < 700;
      if (view === 'ruler') {
        if (autoMorph) {
          const t = (Math.sin(time * 0.55 - Math.PI / 2) + 1) / 2;
          const target = smoothstep(clamp((t - 0.15) / 0.7, 0, 1));
          morphRef.current = target;
        }
        drawRuler(ctx, w, h, mob);
      } else if (view === 'slide') {
        drawSlide(ctx, w, h, mob, dt);
      } else drawMagnitudes(ctx, w, h, mob);
    },
    { animate: true },
  );

  function drawRuler(ctx: CanvasRenderingContext2D, w: number, h: number, mob: boolean) {
    const lo = 0.1;
    const hi = 1e5;
    const x0 = mob ? 24 : 70;
    const x1 = w - (mob ? 24 : 50);
    const W = x1 - x0;
    const t = morphRef.current;
    const posLin = (v: number) => x0 + (v - 0) / (hi - 0) * W;
    const posLog = (v: number) => x0 + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * W;
    const X = (v: number) => posLin(v) * (1 - t) + posLog(v) * t;
    const yAxis = h * (mob ? 0.5 : 0.48);
    // axis
    ctx.strokeStyle = 'rgba(200,215,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, yAxis);
    ctx.lineTo(x1, yAxis);
    ctx.stroke();
    // ticks for each decade
    for (let d = -1; d <= 5; d++) {
      for (let k = 1; k <= 9; k++) {
        const v = k * Math.pow(10, d);
        if (v < lo || v > hi) continue;
        const x = X(v);
        const major = k === 1;
        ctx.strokeStyle = major ? 'rgba(220,230,255,0.85)' : `rgba(180,195,240,${0.18 + 0.25 * t})`;
        ctx.beginPath();
        ctx.moveTo(x, yAxis - (major ? 12 : 6));
        ctx.lineTo(x, yAxis + (major ? 12 : 6));
        ctx.stroke();
        if (major) {
          text(ctx, d >= 0 && d <= 3 ? String(Math.round(v)) : sci(v, 1), x, yAxis + 28, { align: 'center', size: mob ? 10 : 11, color: 'rgba(200,210,240,0.8)', font: FONT_MONO });
          // log value labels
          text(ctx, fix(log(v), base === 'e' ? 2 : base === '2' ? 2 : 0), x, yAxis - 20, { align: 'center', size: mob ? 9 : 10, color: `rgba(124,156,255,${0.2 + 0.8 * t})`, font: FONT_MONO });
        }
      }
    }
    text(ctx, `${baseLabel}(value)`, x0, yAxis - 40, { size: 11, color: `rgba(124,156,255,${0.2 + 0.8 * t})`, font: FONT_MONO });
    text(ctx, t < 0.5 ? 'Linear scale — equal differences, equal steps' : 'Logarithmic scale — equal ratios, equal steps', w / 2, h * 0.27, {
      align: 'center',
      size: mob ? 15 : 20,
      font: FONT_SERIF,
      italic: true,
      color: 'rgba(232,237,251,0.9)',
    });
    // markers
    const mark = (v: number, col: string, lbl: string, up: boolean, lift = 70) => {
      const x = X(v);
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, yAxis, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = col;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, yAxis);
      ctx.lineTo(x, yAxis + (up ? -lift : lift));
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, lbl, x, yAxis + (up ? -lift - 8 : lift + 16), { align: 'center', size: mob ? 12 : 14, color: col, font: FONT_MONO, shadow: true });
    };
    mark(a, GOLD, `a = ${fmt(a, 3)}`, true);
    mark(b, TEAL, `b = ${fmt(b, 3)}`, false);
    mark(ab, PINK, `ab = ${fmt(ab, 4)}`, true, 104);
    // stacked log-length bars (meaningful on the log scale)
    const yb = yAxis + (mob ? 110 : 130);
    const one = X(1);
    ctx.globalAlpha = t * t;
    const bar = (xa: number, xb: number, y: number, col: string, lbl: string) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillRect(Math.min(xa, xb), y - 5, Math.abs(xb - xa), 10);
      ctx.restore();
      text(ctx, lbl, (xa + xb) / 2, y - 10, { align: 'center', size: 11, color: col, font: FONT_MONO });
    };
    bar(one, X(a), yb, GOLD, `${baseLabel} a = ${fix(log(a), 3)}`);
    const lenB = X(b) - one;
    bar(X(a), X(a) + lenB, yb, TEAL, `+ ${baseLabel} b = ${fix(log(b), 3)}`);
    bar(one, X(ab), yb + 34, PINK, `${baseLabel}(ab) = ${fix(log(ab), 3)}`);
    ctx.globalAlpha = 1;
    // linear-mode reminder: product far away
    if (t < 0.3) text(ctx, 'On a linear scale small numbers crowd together at the left…', w / 2, yb + 74, { align: 'center', size: 12, color: 'rgba(180,190,230,0.7)', font: FONT_SERIF, italic: true });
    else text(ctx, 'The gold and teal lengths, laid end to end, exactly reach ab.', w / 2, yb + 74, { align: 'center', size: 12, color: 'rgba(180,190,230,0.85)', font: FONT_SERIF, italic: true });
  }

  function drawSlide(ctx: CanvasRenderingContext2D, w: number, h: number, mob: boolean, dt: number) {
    const x0 = mob ? 20 : 60;
    const x1 = w - (mob ? 20 : 40);
    const W = (x1 - x0) / 2; // one decade width (scales span 1–100)
    const D = (v: number) => x0 + Math.log10(v) * W;
    const yD = h * 0.56;
    const yC = yD - 54;
    const slide = slideRef.current;
    const off = slide * Math.log10(ma) * W;
    if (!dragging.current && !slideUsed && !reduced) setSlide((s) => Math.min(1, s + dt * 0.35));
    // fixed D scale
    const drawScale = (y: number, shift: number, color: string, label: string, flip: boolean) => {
      ctx.fillStyle = 'rgba(14,20,40,0.85)';
      ctx.strokeStyle = 'rgba(160,180,255,0.35)';
      ctx.lineWidth = 1;
      ctx.fillRect(x0 + shift - 4, y - 22, 2 * W + 8, 44);
      ctx.strokeRect(x0 + shift - 4, y - 22, 2 * W + 8, 44);
      for (let d = 0; d < 2; d++)
        for (let k = 1; k <= 10; k++) {
          for (let sub = 0; sub < (k < 10 ? 10 : 1); sub++) {
            const v = (k + sub / 10) * Math.pow(10, d);
            if (v > 100) continue;
            const x = D(v) + shift;
            const len = sub === 0 ? 14 : sub === 5 ? 9 : 5;
            ctx.strokeStyle = sub === 0 ? color : 'rgba(200,210,240,0.35)';
            ctx.beginPath();
            const yy = flip ? y + 22 : y - 22;
            ctx.moveTo(x, yy);
            ctx.lineTo(x, flip ? yy - len : yy + len);
            ctx.stroke();
            if (sub === 0 && (k <= 10 || d === 1)) {
              const lbl = String(k * Math.pow(10, d));
              if (!(mob && k > 5 && k < 10)) text(ctx, lbl, x, flip ? y + 2 : y + 4, { align: 'center', size: 10, color, font: FONT_MONO, baseline: 'middle' });
            }
          }
        }
      text(ctx, label, x0 + shift - 10, y + 4, { align: 'right', size: 12, color, font: FONT_MONO, baseline: 'middle' });
    };
    drawScale(yD, 0, TEAL, 'D', true);
    drawScale(yC, off, GOLD, 'C', false);
    // cursor hairline at C(mb)
    const xr = D(mb) + off;
    ctx.save();
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xr, yC - 40);
    ctx.lineTo(xr, yD + 40);
    ctx.stroke();
    ctx.restore();
    const reading = Math.pow(10, Math.log10(mb) + slide * Math.log10(ma));
    text(ctx, `reads ${fix(reading, 3)}`, xr, yD + 58, { align: 'center', size: 13, color: PINK, font: FONT_MONO, shadow: true });
    // brackets showing the two lengths
    const yBr = yC - 52;
    ctx.strokeStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(D(1), yBr);
    ctx.lineTo(D(1) + off, yBr);
    ctx.stroke();
    text(ctx, `log ${fix(ma, 3)}`, (D(1) + D(1) + off) / 2, yBr - 6, { align: 'center', size: 11, color: GOLD, font: FONT_MONO });
    ctx.strokeStyle = TEAL;
    ctx.beginPath();
    ctx.moveTo(D(1) + off, yBr - 18);
    ctx.lineTo(xr, yBr - 18);
    ctx.stroke();
    text(ctx, `log ${fix(mb, 3)}`, (D(1) + off + xr) / 2, yBr - 24, { align: 'center', size: 11, color: TEAL, font: FONT_MONO });
    text(ctx, 'Drag the C scale. Its 1 slides over a; the hairline at b on C reads a × b on D.', w / 2, h * 0.24, { align: 'center', size: mob ? 13 : 17, font: FONT_SERIF, italic: true });
    if (slide > 0.995)
      text(ctx, `${fix(ma, 3)} × ${fix(mb, 3)} = ${fix(ma * mb, 4)}  → ×10^${ea + eb} → ${fmt(ab, 5)}`, w / 2, yD + 96, { align: 'center', size: mob ? 12 : 14, color: '#fff', font: FONT_MONO });
  }

  function drawMagnitudes(ctx: CanvasRenderingContext2D, w: number, h: number, mob: boolean) {
    const list = scaleKind === 'distance' ? DISTANCES : SOUNDS;
    const lo = scaleKind === 'distance' ? -16 : -13;
    const hi = scaleKind === 'distance' ? 28 : 3;
    const x0 = mob ? 20 : 60;
    const x1 = w - (mob ? 20 : 40);
    const X = (e: number) => x0 + ((e - lo) / (hi - lo)) * (x1 - x0);
    const y = h * 0.55;
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, TEAL);
    grad.addColorStop(1, BLUE);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    for (let e = lo; e <= hi; e++) {
      const x = X(e);
      const major = e % (scaleKind === 'distance' ? 4 : 2) === 0;
      ctx.strokeStyle = major ? 'rgba(220,230,255,0.7)' : 'rgba(180,195,240,0.25)';
      ctx.beginPath();
      ctx.moveTo(x, y - (major ? 9 : 5));
      ctx.lineTo(x, y + (major ? 9 : 5));
      ctx.stroke();
      if (major) text(ctx, scaleKind === 'distance' ? `10^${e}` : `${(e + 12) * 10} dB`, x, y + 24, { align: 'center', size: 10, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
    }
    list.forEach((item, i) => {
      const x = X(Math.log10(item.v));
      const up = i % 2 === 0;
      const yy = y + (up ? -1 : 1) * (40 + (i % 4 < 2 ? 0 : 34));
      ctx.strokeStyle = 'rgba(160,180,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, yy + (up ? 8 : -12));
      ctx.stroke();
      ctx.fillStyle = up ? GOLD : TEAL;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, item.label, x, yy, { align: 'center', size: mob ? 9.5 : 11.5, color: 'rgba(232,237,251,0.92)', shadow: true });
    });
    // cursor
    const ce = lo + cursor * (hi - lo);
    const cx = X(ce);
    ctx.save();
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y - 110);
    ctx.lineTo(cx, y + 110);
    ctx.stroke();
    ctx.restore();
    const val = Math.pow(10, ce);
    text(ctx, scaleKind === 'distance' ? `${sci(val, 3)} m` : `${sci(val, 2)} W/m² = ${fix(10 * Math.log10(val / 1e-12), 0)} dB`, cx, y - 120, {
      align: 'center',
      size: 14,
      color: PINK,
      font: FONT_MONO,
      shadow: true,
    });
    text(
      ctx,
      scaleKind === 'distance'
        ? `${hi - lo} orders of magnitude on one ruler. On a linear ruler this wide, each pixel would span ${sci(8.8e26 / (x1 - x0), 1)} m — everything but the universe would share the first pixel.`
        : 'Each 10 dB step multiplies sound intensity by ten. Hearing spans about 14 orders of magnitude.',
      w / 2,
      h * 0.24,
      { align: 'center', size: mob ? 12 : 15, font: FONT_SERIF, italic: true, color: 'rgba(232,237,251,0.88)' },
    );
  }

  usePointer(canvasRef, {
    down: (p) => {
      const w = canvasRef.current!.clientWidth;
      const h = canvasRef.current!.clientHeight;
      if (view === 'slide') {
        const yC = h * 0.56 - 54;
        if (Math.abs(p.y - yC) < 40) {
          dragging.current = 'slide';
          setSlideUsed(true);
          return;
        }
        return false;
      }
      if (view === 'magnitudes') {
        dragging.current = 'cursor';
        const x0 = w < 700 ? 20 : 60;
        const x1 = w - (w < 700 ? 20 : 40);
        setCursor(clamp((p.x - x0) / (x1 - x0), 0, 1));
        return;
      }
      return false;
    },
    move: (p, drag) => {
      if (!drag) return;
      const w = canvasRef.current!.clientWidth;
      if (dragging.current === 'slide') {
        const x0 = w < 700 ? 20 : 60;
        const x1 = w - (w < 700 ? 20 : 40);
        const W = (x1 - x0) / 2;
        const full = Math.log10(ma) * W;
        if (full > 0) setSlide((s) => clamp(s + p.dx / full, 0, 1));
      } else if (dragging.current === 'cursor') {
        const x0 = w < 700 ? 20 : 60;
        const x1 = w - (w < 700 ? 20 : 40);
        setCursor(clamp((p.x - x0) / (x1 - x0), 0, 1));
      }
    },
    up: () => {
      dragging.current = null;
    },
  });

  const reset = () => {
    setA(3);
    setB(25);
    setBase('10');
    setMorph(reduced ? 1 : 0);
    setAutoMorph(!reduced);
    setSlide(0);
    setSlideUsed(false);
    setCursor(0.5);
  };

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Number line morphing between linear and logarithmic scales" />}
      onReset={reset}
      toolbar={
        view === 'ruler' ? (
          <Btn onClick={() => setAutoMorph((m) => !m)} icon={autoMorph ? Icon.pause : Icon.play} title={autoMorph ? 'Pause the morph' : 'Animate the morph'}>
            {autoMorph ? 'Pause morph' : 'Animate'}
          </Btn>
        ) : view === 'slide' ? (
          <Btn onClick={() => { setSlide(0); setSlideUsed(false); }} icon={Icon.play}>
            Replay slide
          </Btn>
        ) : null
      }
      notice={
        view === 'ruler' && Math.abs(log(a) + log(b) - log(ab)) < 1e-9 && morph > 0.95 ? (
          <Callout tone="event">
            <strong>{baseLabel}</strong> {fmt(a, 3)} + <strong>{baseLabel}</strong> {fmt(b, 3)} = {fix(log(a), 4)} + {fix(log(b), 4)} = {fix(log(ab), 4)} = <strong>{baseLabel}</strong>({fmt(ab, 4)})
          </Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'ruler', label: 'Linear ↔ log' },
              { value: 'slide', label: 'Slide rule' },
              { value: 'magnitudes', label: 'Orders of magnitude' },
            ]}
          />
          {view !== 'magnitudes' && (
            <ControlGroup title="Numbers">
              <Slider label="First number" tex="a" value={a} min={0.2} max={300} log onChange={setA} format={(v) => fmt(v, 3)} step={0.01} />
              <Slider label="Second number" tex="b" value={b} min={0.2} max={300} log onChange={setB} format={(v) => fmt(v, 3)} step={0.01} />
              <div className="btn-row">
                <Btn onClick={() => { setA(8); setB(16); }}>8 × 16</Btn>
                <Btn onClick={() => { setA(2); setB(50); }}>2 × 50</Btn>
                <Btn onClick={() => { setA(3.7); setB(2.4); }}>3.7 × 2.4</Btn>
              </div>
            </ControlGroup>
          )}
          {view === 'ruler' && (
            <ControlGroup title="Scale">
              <Segmented
                label="Logarithm base"
                value={base}
                onChange={setBase}
                options={[
                  { value: '10', label: 'base 10' },
                  { value: '2', label: 'base 2' },
                  { value: 'e', label: 'base e (ln)' },
                ]}
              />
              <Slider
                label="Linear → logarithmic"
                value={morph}
                min={0}
                max={1}
                onChange={(v) => {
                  setAutoMorph(false);
                  setMorph(v);
                }}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </ControlGroup>
          )}
          {view === 'magnitudes' && (
            <ControlGroup title="Ruler">
              <Segmented
                value={scaleKind}
                onChange={setScaleKind}
                options={[
                  { value: 'distance', label: 'Cosmic distances' },
                  { value: 'sound', label: 'Sound intensity' },
                ]}
              />
              <p className="responds" style={{ margin: 0 }}>Drag across the ruler to read any value. Sizes are approximate, for scale only.</p>
            </ControlGroup>
          )}
        </>
      }
      readouts={
        view === 'magnitudes' ? undefined : (
          <Readouts
            items={[
              { label: `${baseLabel} a`, value: fix(log(a), 5) },
              { label: `${baseLabel} b`, value: fix(log(b), 5) },
              { label: 'sum of logs', value: fix(log(a) + log(b), 5), accent: true },
              { label: `${baseLabel}(ab)`, value: fix(log(ab), 5), accent: true },
              { label: 'product ab', value: fmt(ab, 6) },
              { label: 'change of base', value: `ln x / ${fix(lb, 4)}` },
            ]}
          />
        )
      }
    />
  );
}
