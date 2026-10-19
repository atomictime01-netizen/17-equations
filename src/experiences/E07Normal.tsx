import { useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { axes, FONT_MONO, handle, mapper, text } from '../core/draw';
import { gaussianSampler, mulberry32, clamp, fix, fmt } from '../math/rng';
import { normalInterval, normalPdf } from '../math/stats';

const CORAL = '#ff8f7a';
const GOLD = '#ffd36e';
const SKY = '#7ad8ff';
const ZBIN = 0.2; // histogram bins are 0.2σ wide, aligned on μ
const ZMAX = 7;
const NB = Math.round((2 * ZMAX) / ZBIN);
const MAXN = 250000;

type Source = 'normal' | 'clt';

export default function NormalDistribution() {
  const reduced = useReducedMotion();
  const [mu, setMu] = useState(0);
  const [sigma, setSigma] = useState(1.5);
  const [source, setSource] = useState<Source>('normal');
  const [k, setK] = useState(2);
  const [lo, setLo] = useState(-1.5);
  const [hi, setHi] = useState(1.5);
  const [stream, setStream] = useState(!reduced);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const store = useRef({ z: new Float32Array(MAXN), n: 0, bins: new Float64Array(NB), landedN: 0, flight: [] as { z: number; t: number; x0: number }[] });
  const rng = useRef(mulberry32(2024));
  const gauss = useRef(gaussianSampler(rng.current));
  const drag = useRef<null | 'lo' | 'hi'>(null);
  const streamAcc = useRef(0);

  const stats = useThrottledValue(() => {
    const s = store.current;
    const n = s.n;
    let sum = 0;
    let sum2 = 0;
    let inside = 0;
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    for (let i = 0; i < n; i++) {
      const x = mu + sigma * s.z[i];
      sum += x;
      sum2 += x * x;
      if (x >= a && x <= b) inside++;
    }
    const mean = n ? sum / n : NaN;
    const sd = n > 1 ? Math.sqrt(Math.max(0, (sum2 - n * mean * mean) / (n - 1))) : NaN;
    return { n, mean, sd, frac: n ? inside / n : NaN };
  }, 200);

  const sampleZ = () => {
    if (source === 'normal') return gauss.current();
    let s = 0;
    for (let i = 0; i < k; i++) s += rng.current();
    return (s - k / 2) / Math.sqrt(k / 12);
  };

  const add = (count: number) => {
    const s = store.current;
    const animateEvery = Math.max(1, Math.floor(count / 260));
    for (let i = 0; i < count && s.n < MAXN; i++) {
      const z = sampleZ();
      s.z[s.n++] = z;
      if (!reduced && i % animateEvery === 0 && s.flight.length < 600) s.flight.push({ z, t: 0, x0: (rng.current() - 0.5) * 0.6 });
      else landZ(z);
    }
  };
  /** Bins live in standard units (z), so changing μ or σ re-maps them without recounting. */
  const landZ = (z: number) => {
    const s = store.current;
    const idx = Math.floor((z + ZMAX) / ZBIN);
    if (idx >= 0 && idx < NB) s.bins[idx]++;
    s.landedN++;
  };

  const clear = () => {
    const s = store.current;
    s.n = 0;
    s.flight = [];
    s.bins.fill(0);
    s.landedN = 0;
  };

  const isTwoSigma = Math.abs(Math.min(lo, hi) - (mu - 2 * sigma)) < 0.03 * sigma && Math.abs(Math.max(lo, hi) - (mu + 2 * sigma)) < 0.03 * sigma;
  useGoalWhen('n-10k', stats.n >= 10000);
  useGoalWhen('n-2s', isTwoSigma);
  useGoalWhen('n-clt', source === 'clt' && k >= 3 && stats.n >= 500);

  const geom = (w: number, h: number) => {
    const mob = w < 700;
    const top = mob ? 120 : 160;
    const peak = 1 / (sigma * Math.sqrt(2 * Math.PI));
    return mapper({ x: mob ? 36 : 60, y: top, w: w - (mob ? 54 : 90), h: h - top - 70 }, [mu - 4.6 * Math.max(sigma, 1.2), mu + 4.6 * Math.max(sigma, 1.2)], [0, peak * 1.3]);
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const s = store.current;
      if (stream) {
        streamAcc.current += dt * 60;
        const c = Math.floor(streamAcc.current);
        if (c > 0) {
          add(c);
          streamAcc.current -= c;
        }
      }
      const m = geom(w, h);
      axes(ctx, m, { xLabel: 'x', yLabel: 'density f(x)', fmtY: (v) => fix(v, 2) });
      // histogram of landed samples, density = count / (n · bin width)
      const n = Math.max(1, s.landedN);
      const binW = ZBIN * sigma;
      const a = Math.min(lo, hi);
      const bb = Math.max(lo, hi);
      for (let b = 0; b < NB; b++) {
        const c = s.bins[b];
        if (!c) continue;
        const xl = mu + sigma * (-ZMAX + b * ZBIN);
        const dens = c / (n * binW);
        const inside = xl + binW / 2 >= a && xl + binW / 2 <= bb;
        ctx.fillStyle = inside ? 'rgba(255,143,122,0.55)' : 'rgba(122,216,255,0.32)';
        const y = m.Y(Math.min(dens, m.yr[1]));
        const px0 = m.X(xl);
        const px1 = m.X(xl + binW);
        if (px1 < m.rect.x || px0 > m.rect.x + m.rect.w) continue;
        ctx.fillRect(px0 + 0.5, y, Math.max(1, px1 - px0 - 1), m.Y(0) - y);
      }
      // shaded probability under the theoretical curve
      ctx.beginPath();
      ctx.moveTo(m.X(a), m.Y(0));
      for (let i = 0; i <= 160; i++) {
        const x = a + ((bb - a) * i) / 160;
        ctx.lineTo(m.X(x), m.Y(normalPdf(x, mu, sigma)));
      }
      ctx.lineTo(m.X(bb), m.Y(0));
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, m.rect.y, 0, m.Y(0));
      gr.addColorStop(0, 'rgba(255,211,110,0.35)');
      gr.addColorStop(1, 'rgba(255,143,122,0.12)');
      ctx.fillStyle = gr;
      ctx.fill();
      // σ markers
      for (let j = -3; j <= 3; j++) {
        const x = mu + j * sigma;
        ctx.strokeStyle = j === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(m.X(x), m.rect.y + 10);
        ctx.lineTo(m.X(x), m.Y(0));
        ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, j === 0 ? 'μ' : `${j > 0 ? '+' : '−'}${Math.abs(j)}σ`, m.X(x), m.rect.y + 6, { align: 'center', size: 10, color: 'rgba(200,210,240,0.6)', font: FONT_MONO });
      }
      // theoretical curve
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) {
        const x = m.xr[0] + ((m.xr[1] - m.xr[0]) * i) / 400;
        const y = normalPdf(x, mu, sigma);
        if (i) ctx.lineTo(m.X(x), m.Y(y));
        else ctx.moveTo(m.X(x), m.Y(y));
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = CORAL;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
      // falling samples
      for (let i = s.flight.length - 1; i >= 0; i--) {
        const f = s.flight[i];
        f.t += dt * 1.6;
        const x = mu + sigma * f.z;
        const yTop = m.rect.y - 40;
        const yEnd = m.Y(0) - 2;
        const e = f.t * f.t;
        const py = yTop + (yEnd - yTop) * Math.min(1, e);
        const px = m.X(x + f.x0 * (1 - Math.min(1, f.t)) * sigma);
        ctx.fillStyle = `rgba(255,${200 - 60 * Math.min(1, f.t)},150,${0.9})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (f.t >= 1) {
          s.flight.splice(i, 1);
          landZ(f.z);
        }
      }
      // interval handles
      handle(ctx, m.X(a), m.Y(0), GOLD, drag.current === 'lo');
      handle(ctx, m.X(bb), m.Y(0), GOLD, drag.current === 'hi');
      const P = normalInterval(a, bb, mu, sigma);
      text(ctx, `P(${fix(a, 2)} ≤ X ≤ ${fix(bb, 2)}) = ${fix(P * 100, 2)}%`, m.X((a + bb) / 2), m.Y(normalPdf((a + bb) / 2, mu, sigma)) - 18, {
        align: 'center',
        size: 13,
        color: GOLD,
        font: FONT_MONO,
        shadow: true,
      });
      if (hoverX !== null) {
        const y = normalPdf(hoverX, mu, sigma);
        ctx.strokeStyle = 'rgba(122,216,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(m.X(hoverX), m.Y(0));
        ctx.lineTo(m.X(hoverX), m.Y(y));
        ctx.stroke();
        text(ctx, `f(${fix(hoverX, 2)}) = ${fix(y, 4)} per unit x — a density, not a probability`, m.X(hoverX) + 8, m.Y(y) - 8, { size: 11, color: SKY, font: FONT_MONO, shadow: true });
      }
    },
    { animate: true },
  );

  usePointer(canvasRef, {
    down: (p) => {
      const m = geom(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
      const a = Math.min(lo, hi);
      const b = Math.max(lo, hi);
      const dA = Math.abs(p.x - m.X(a));
      const dB = Math.abs(p.x - m.X(b));
      if (Math.min(dA, dB) > 26 || Math.abs(p.y - m.Y(0)) > 60) return false;
      drag.current = dA < dB ? 'lo' : 'hi';
      if (lo > hi) {
        setLo(a);
        setHi(b);
      }
    },
    move: (p, dragging) => {
      const m = geom(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
      const x = clamp(m.invX(p.x), m.xr[0], m.xr[1]);
      if (!dragging) {
        setHoverX(p.y > m.rect.y && p.y < m.Y(0) ? x : null);
        return;
      }
      const snap = (v: number) => {
        const zz = (v - mu) / sigma;
        const r = Math.round(zz);
        return Math.abs(zz - r) < 0.06 ? mu + r * sigma : v;
      };
      if (drag.current === 'lo') setLo(snap(x));
      else if (drag.current === 'hi') setHi(snap(x));
    },
    up: () => (drag.current = null),
    leave: () => setHoverX(null),
  });

  const setSigmaBand = (j: number) => {
    setLo(mu - j * sigma);
    setHi(mu + j * sigma);
  };

  const reset = () => {
    setMu(0);
    setSigma(1.5);
    setSource('normal');
    setK(2);
    setLo(-1.5);
    setHi(1.5);
    clear();
    setStream(!reduced);
  };

  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const P = normalInterval(a, b, mu, sigma);
  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Normal distribution curve with a histogram of random samples and a shaded interval" />}
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setStream((s) => !s)} icon={stream ? Icon.pause : Icon.play}>
            {stream ? 'Pause stream' : 'Stream samples'}
          </Btn>
          <Btn onClick={() => add(1000)}>+1 000</Btn>
          <Btn onClick={() => add(10000)}>+10 000</Btn>
          <Btn onClick={clear}>Clear</Btn>
        </>
      }
      notice={
        stats.n > 2000 ? (
          <Callout tone="event">
            With n = {fmt(stats.n, 3)}, the empirical fraction {fix(stats.frac * 100, 2)}% sits {fix(Math.abs(stats.frac - P) * 100, 2)} points from the theoretical {fix(P * 100, 2)}%.
          </Callout>
        ) : undefined
      }
      controls={
        <>
          <ControlGroup title="Distribution">
            <Slider label="Mean" tex="\mu" value={mu} min={-4} max={4} step={0.05} onChange={(v) => { setLo(lo + (v - mu)); setHi(hi + (v - mu)); setMu(v); }} format={(v) => fix(v, 2)} tip="Shifts the curve and every sample." />
            <Slider label="Standard deviation" tex="\sigma" value={sigma} min={0.4} max={3} step={0.01} onChange={setSigma} format={(v) => fix(v, 2)} tip="Wider spread, lower peak: the area always stays 1." />
            <Segmented
              label="Random source"
              value={source}
              onChange={(v) => {
                setSource(v);
                clear();
              }}
              options={[
                { value: 'normal', label: 'Box–Muller normal' },
                { value: 'clt', label: 'Sum of k uniform numbers' },
              ]}
            />
            {source === 'clt' && (
              <Slider label="Numbers summed" tex="k" value={k} min={1} max={12} step={1} onChange={(v) => { setK(Math.round(v)); clear(); }} format={(v) => String(Math.round(v))} tip="Each sample adds k uniform random numbers, then standardises. k = 1 is flat; the central limit theorem pulls larger k toward the bell." />
            )}
          </ControlGroup>
          <ControlGroup title="Interval">
            <div className="btn-row">
              <Btn onClick={() => setSigmaBand(1)}>μ ± 1σ</Btn>
              <Btn onClick={() => setSigmaBand(2)}>μ ± 2σ</Btn>
              <Btn onClick={() => setSigmaBand(3)}>μ ± 3σ</Btn>
            </div>
            <p className="responds" style={{ margin: 0 }}>Drag the gold handles on the axis to choose any interval.</p>
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'P(a ≤ X ≤ b) theory', value: `${fix(P * 100, 3)}%`, accent: true },
            { label: 'fraction of samples', value: Number.isFinite(stats.frac) ? `${fix(stats.frac * 100, 3)}%` : '—' },
            { label: 'samples n', value: fmt(stats.n, 6) },
            { label: 'sample mean', value: Number.isFinite(stats.mean) ? fix(stats.mean, 3) : '—' },
            { label: 'sample std dev', value: Number.isFinite(stats.sd) ? fix(stats.sd, 3) : '—' },
            { label: 'peak density f(μ)', value: fix(normalPdf(mu, mu, sigma), 4), hint: 'A density can exceed 1 — it is not a probability.' },
            { label: 'P(X = exactly μ)', value: '0' },
            { label: 'standard error of mean', value: stats.n > 1 ? fix(sigma / Math.sqrt(stats.n), 4) : '—' },
          ]}
        />
      }
    />
  );
}
