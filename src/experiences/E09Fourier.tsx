import { useEffect, useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion } from '../core/hooks';
import { FONT_MONO, text } from '../core/draw';
import { amplitudeSpectrum, applyGain, fft, ifftReal, synthesize, type Sinusoid } from '../math/fourier';
import { clamp, fix, gaussianSampler, mulberry32 } from '../math/rng';
import { audio } from '../core/audio';

const N = 512;
const KMAX = 80;
const YEL = '#ffe14d';
const PINK = '#ff5d8f';
type Preset = 'sum' | 'square' | 'saw' | 'triangle' | 'chord' | 'noise' | 'draw';
type Filter = 'none' | 'low' | 'high' | 'band';

function presetSignal(p: Preset, comps: Sinusoid[], drawn: Float64Array | null): Float64Array {
  const x = new Float64Array(N);
  const f = 4; // cycles per window
  if (p === 'sum') return synthesize(comps, N);
  if (p === 'draw' && drawn) return Float64Array.from(drawn);
  for (let n = 0; n < N; n++) {
    const ph = ((n * f) / N) % 1;
    if (p === 'square') x[n] = ph < 0.5 ? 0.8 : -0.8;
    else if (p === 'saw') x[n] = 1.6 * (ph - 0.5);
    else if (p === 'triangle') x[n] = ph < 0.5 ? -0.8 + 3.2 * ph : 2.4 - 3.2 * ph;
    else if (p === 'chord') x[n] = 0.42 * (Math.sin((2 * Math.PI * 16 * n) / N) + Math.sin((2 * Math.PI * 20 * n) / N + 0.7) + Math.sin((2 * Math.PI * 24 * n) / N + 1.9));
  }
  if (p === 'noise') {
    const g = gaussianSampler(mulberry32(77));
    for (let n = 0; n < N; n++) x[n] = 0.7 * Math.sin((2 * Math.PI * 6 * n) / N) + 0.32 * g();
  }
  return x;
}

export default function Fourier() {
  const reduced = useReducedMotion();
  const [preset, setPreset] = useState<Preset>('chord');
  const [comps, setComps] = useState<Sinusoid[]>([
    { freq: 3, amp: 0.7, phase: 0 },
    { freq: 7, amp: 0.35, phase: 1.2 },
    { freq: 13, amp: 0.2, phase: -0.6 },
  ]);
  const [drawn, setDrawn] = useState<Float64Array | null>(null);
  const [drawUsed, setDrawUsed] = useState(false);
  const [terms, setTerms] = useState(12);
  const [filter, setFilter] = useState<Filter>('none');
  const [cut, setCut] = useState<[number, number]>([10, 40]);
  const [running, setRunning] = useState(!reduced);
  const [playing, setPlaying] = useState(false);
  const phaseRef = useRef(0);
  const drag = useRef<null | 'draw' | 'c0' | 'c1'>(null);
  const lastDraw = useRef<[number, number] | null>(null);
  const drawBuf = useRef<Float64Array>(new Float64Array(N));
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const signal = useMemo(() => presetSignal(preset, comps, drawn), [preset, comps, drawn]);
  const spec = useMemo(() => fft(signal), [signal]);
  const { amp, phase } = useMemo(() => amplitudeSpectrum(spec), [spec]);
  const gain = (k: number) => {
    if (filter === 'low') return k <= cut[0] ? 1 : 0;
    if (filter === 'high') return k >= cut[0] ? 1 : 0;
    if (filter === 'band') return k >= Math.min(cut[0], cut[1]) && k <= Math.max(cut[0], cut[1]) ? 1 : 0;
    return 1;
  };
  // components after filtering, ranked by amplitude; keep the strongest `terms` for epicycles & reconstruction
  const kept = useMemo(() => {
    const list: { k: number; a: number; p: number }[] = [];
    for (let k = 0; k <= N / 2; k++) if (gain(k) > 0 && amp[k] > 1e-6) list.push({ k, a: amp[k], p: phase[k] });
    list.sort((x, y) => y.a - x.a);
    return list.slice(0, terms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amp, phase, filter, cut, terms]);
  const recon = useMemo(() => {
    const keep = new Set(kept.map((c) => c.k));
    return ifftReal(applyGain(spec, (k) => (keep.has(k) ? 1 : 0)));
  }, [spec, kept]);
  const filteredFull = useMemo(() => ifftReal(applyGain(spec, gain)), [spec, filter, cut]); // eslint-disable-line react-hooks/exhaustive-deps

  const energy = (x: ArrayLike<number>) => {
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    return s;
  };
  const eTotal = energy(signal);
  const eKept = energy(recon);
  let err = 0;
  for (let i = 0; i < N; i++) err += (signal[i] - recon[i]) ** 2;
  const rms = Math.sqrt(err / N);
  let domK = 1;
  for (let k = 1; k <= N / 2; k++) if (amp[k] > amp[domK]) domK = k;

  useGoalWhen('f-square', preset === 'square');
  useGoalWhen('f-filter', preset === 'noise' && filter === 'low' && cut[0] <= 20);
  useGoalWhen('f-draw', drawUsed);

  // audio: one window = one period at 55 Hz (so 4 cycles per window → 220 Hz)
  const stopAudio = () => {
    try {
      srcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    srcRef.current = null;
  };
  const startAudio = (wave: Float64Array) => {
    audio.start();
    const ctx = audio.ctx;
    if (!ctx || !audio.master) return;
    stopAudio();
    const f0 = 55;
    const len = Math.round(ctx.sampleRate / f0) * 8;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let peak = 1e-9;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(wave[i]));
    const per = len / 8;
    for (let i = 0; i < len; i++) {
      const pos = ((i % per) / per) * N;
      const i0 = Math.floor(pos);
      const fr = pos - i0;
      d[i] = ((wave[i0 % N] * (1 - fr) + wave[(i0 + 1) % N] * fr) / peak) * 0.22;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(g).connect(audio.master);
    src.start();
    srcRef.current = src;
  };
  useEffect(() => {
    if (playing) startAudio(recon);
    else stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, recon]);
  useEffect(() => () => stopAudio(), []);

  const layout = (w: number, h: number) => {
    const mob = w < 700;
    const top = mob ? 118 : 150;
    const pad = mob ? 14 : 36;
    const total = h - top - 56;
    const sigH = total * 0.36;
    const epiH = total * 0.32;
    const specH = total - sigH - epiH - 24;
    return {
      sig: { x: pad, y: top, w: w - 2 * pad, h: sigH },
      epi: { x: pad, y: top + sigH + 10, w: w - 2 * pad, h: epiH },
      spec: { x: pad, y: top + sigH + epiH + 24, w: w - 2 * pad, h: specH },
    };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const L = layout(w, h);
      if (running) phaseRef.current = (phaseRef.current + dt * 0.06) % 1;
      // ── signal panel
      const s = L.sig;
      const ys = (v: number) => s.y + s.h / 2 - v * (s.h / 2.6);
      ctx.strokeStyle = 'rgba(160,180,255,0.15)';
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      ctx.beginPath();
      ctx.moveTo(s.x, ys(0));
      ctx.lineTo(s.x + s.w, ys(0));
      ctx.stroke();
      const plot = (arr: ArrayLike<number>, col: string, width: number, glow: number) => {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const x = s.x + (i / (N - 1)) * s.w;
          const y = ys(clamp(arr[i], -1.25, 1.25));
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = width;
        ctx.shadowColor = col;
        ctx.shadowBlur = glow;
        ctx.stroke();
        ctx.restore();
      };
      plot(drag.current === 'draw' ? drawBuf.current : signal, 'rgba(255,255,255,0.35)', 1.4, 0);
      if (drag.current !== 'draw') plot(recon, YEL, 2.2, 12);
      // playhead synced with epicycles
      const ph = phaseRef.current;
      const px = s.x + ph * s.w;
      ctx.strokeStyle = 'rgba(255,93,143,0.6)';
      ctx.beginPath();
      ctx.moveTo(px, s.y);
      ctx.lineTo(px, s.y + s.h);
      ctx.stroke();
      text(ctx, preset === 'draw' ? 'signal — draw here' : 'signal f(t)  ·  white: original  ·  gold: rebuilt from the kept components', s.x + 6, s.y + 14, { size: 11, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });

      // ── epicycles
      const e = L.epi;
      const R0 = e.h / 2.6;
      let cx = e.x + Math.min(e.w * 0.22, R0 * 2.2);
      let cy = e.y + e.h / 2;
      const t = ph * N;
      ctx.lineWidth = 1;
      for (let i = 0; i < kept.length; i++) {
        const c = kept[i];
        const r = c.a * R0 * (c.k === 0 ? 1 : 1);
        const th = (2 * Math.PI * c.k * t) / N + c.p;
        const nx = cx + r * Math.cos(th + Math.PI / 2);
        const ny = cy - r * Math.sin(th + Math.PI / 2);
        if (c.k !== 0) {
          ctx.strokeStyle = `rgba(255,225,77,${0.12 + 0.3 * (1 - i / kept.length)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = i === 0 ? PINK : 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        cx = nx;
        cy = ny;
      }
      // the vertical displacement of the tip equals the signal value
      const traceX0 = e.x + Math.min(e.w * 0.22, R0 * 2.2) + R0 * 1.25;
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(255,93,143,0.6)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(traceX0, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PINK;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // scrolling trace of the tip height
      ctx.save();
      ctx.beginPath();
      const trW = e.x + e.w - traceX0;
      for (let i = 0; i <= 200; i++) {
        const tt = t - (i / 200) * N * 0.5;
        const idx = ((Math.round(tt) % N) + N) % N;
        const x = traceX0 + (i / 200) * trW;
        const y = e.y + e.h / 2 - recon[idx] * R0;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = PINK;
      ctx.shadowColor = PINK;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
      text(ctx, `${kept.length} rotating phasors (largest first)`, e.x + 6, e.y + 12, { size: 11, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });

      // ── spectrum
      const sp = L.spec;
      const K = Math.min(KMAX, N / 2);
      const bw = sp.w / (K + 1);
      let amax = 0.05;
      for (let k = 0; k <= K; k++) amax = Math.max(amax, amp[k]);
      const keepSet = new Set(kept.map((c) => c.k));
      // filter shading
      for (let k = 0; k <= K; k++) {
        if (gain(k) > 0) continue;
        ctx.fillStyle = 'rgba(255,93,143,0.06)';
        ctx.fillRect(sp.x + k * bw, sp.y, bw, sp.h);
      }
      for (let k = 0; k <= K; k++) {
        const hgt = (amp[k] / amax) * (sp.h - 16);
        const pass = gain(k) > 0;
        ctx.fillStyle = !pass ? 'rgba(255,93,143,0.35)' : keepSet.has(k) ? YEL : 'rgba(93,255,207,0.55)';
        ctx.fillRect(sp.x + k * bw + 1, sp.y + sp.h - hgt, Math.max(1, bw - 2), hgt);
      }
      ctx.strokeStyle = 'rgba(160,180,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y + sp.h);
      ctx.lineTo(sp.x + sp.w, sp.y + sp.h);
      ctx.stroke();
      for (let k = 0; k <= K; k += 10) text(ctx, String(k), sp.x + k * bw + bw / 2, sp.y + sp.h + 13, { align: 'center', size: 10, color: 'rgba(200,210,240,0.6)', font: FONT_MONO });
      text(ctx, 'spectrum |X[k]| — frequency k in cycles per window', sp.x + 6, sp.y + 10, { size: 11, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
      if (filter !== 'none') {
        const hs = filter === 'band' ? [cut[0], cut[1]] : [cut[0]];
        hs.forEach((kk, i) => {
          const x = sp.x + kk * bw + bw / 2;
          ctx.strokeStyle = PINK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, sp.y);
          ctx.lineTo(x, sp.y + sp.h);
          ctx.stroke();
          ctx.fillStyle = PINK;
          ctx.beginPath();
          ctx.arc(x, sp.y + 6, drag.current === (i ? 'c1' : 'c0') ? 7 : 5.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    },
    { animate: true },
  );

  usePointer(canvasRef, {
    down: (p) => {
      const el = canvasRef.current!;
      const L = layout(el.clientWidth, el.clientHeight);
      const s = L.sig;
      if (preset === 'draw' && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) {
        drag.current = 'draw';
        drawBuf.current = drawn ? Float64Array.from(drawn) : new Float64Array(N);
        lastDraw.current = null;
        paint(p.x, p.y);
        return;
      }
      const sp = L.spec;
      if (filter !== 'none' && p.y >= sp.y - 10 && p.y <= sp.y + sp.h) {
        const bw = sp.w / (Math.min(KMAX, N / 2) + 1);
        const k = (p.x - sp.x) / bw;
        const d0 = Math.abs(k - cut[0]);
        const d1 = filter === 'band' ? Math.abs(k - cut[1]) : Infinity;
        drag.current = d0 <= d1 ? 'c0' : 'c1';
        moveCut(p.x);
        return;
      }
      return false;
    },
    move: (p, dragging) => {
      if (!dragging) return;
      if (drag.current === 'draw') paint(p.x, p.y);
      else if (drag.current === 'c0' || drag.current === 'c1') moveCut(p.x);
    },
    up: () => {
      if (drag.current === 'draw') {
        setDrawn(Float64Array.from(drawBuf.current));
        setDrawUsed(true);
      }
      drag.current = null;
    },
  });

  function paint(px: number, py: number) {
    const el = canvasRef.current!;
    const s = layout(el.clientWidth, el.clientHeight).sig;
    const i = clamp(Math.round(((px - s.x) / s.w) * (N - 1)), 0, N - 1);
    const v = clamp((s.y + s.h / 2 - py) / (s.h / 2.6), -1.2, 1.2);
    const prev = lastDraw.current;
    if (prev) {
      const [pi, pv] = prev;
      const a = Math.min(pi, i);
      const b = Math.max(pi, i);
      for (let k = a; k <= b; k++) drawBuf.current[k] = b === a ? v : pv + ((v - pv) * (k - pi)) / (i - pi);
    } else drawBuf.current[i] = v;
    lastDraw.current = [i, v];
  }
  function moveCut(px: number) {
    const el = canvasRef.current!;
    const sp = layout(el.clientWidth, el.clientHeight).spec;
    const bw = sp.w / (Math.min(KMAX, N / 2) + 1);
    const k = clamp(Math.round((px - sp.x - bw / 2) / bw), 0, KMAX);
    if (drag.current === 'c0') setCut(([, b]) => [k, b]);
    else setCut(([a]) => [a, k]);
  }

  const reset = () => {
    setPreset('chord');
    setTerms(12);
    setFilter('none');
    setCut([10, 40]);
    setPlaying(false);
    setRunning(!reduced);
    setComps([
      { freq: 3, amp: 0.7, phase: 0 },
      { freq: 7, amp: 0.35, phase: 1.2 },
      { freq: 13, amp: 0.2, phase: -0.6 },
    ]);
  };

  const updateComp = (i: number, patch: Partial<Sinusoid>) => setComps((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const COLORS = ['#ffe14d', '#ff5d8f', '#5dffcf', '#7ab0ff', '#ffa65d', '#c48cff'];

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Signal, rotating phasors and frequency spectrum" />}
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Spin'}
          </Btn>
          <Btn onClick={() => setPlaying((p) => !p)} icon={playing ? Icon.pause : Icon.audio} pressed={playing} title="Play the rebuilt signal as sound (starts only when you press)">
            {playing ? 'Stop sound' : 'Listen'}
          </Btn>
        </>
      }
      notice={
        preset === 'square' && terms < 40 ? (
          <Callout tone="event">Only odd multiples of the base frequency (4, 12, 20, …) appear, with amplitudes ∝ 1/k. Near each jump the partial sum overshoots by ≈ 9% — the Gibbs phenomenon.</Callout>
        ) : preset === 'noise' && filter === 'low' ? (
          <Callout tone="success">The low-pass filter discards high-frequency hiss; the 6-cycle tone survives almost untouched.</Callout>
        ) : playing ? (
          <Callout tone="info">Playing the gold signal, looped at 55 Hz per window. Use the speaker button in the top bar to mute.</Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="Signal"
            value={preset}
            onChange={(p) => {
              setPreset(p);
              if (p === 'noise') setFilter('none');
            }}
            options={[
              { value: 'square', label: 'Square' },
              { value: 'saw', label: 'Sawtooth' },
              { value: 'triangle', label: 'Triangle' },
              { value: 'chord', label: 'Major chord' },
              { value: 'noise', label: 'Tone + noise' },
              { value: 'sum', label: 'Build your own' },
              { value: 'draw', label: 'Draw ✎' },
            ]}
          />
          {preset === 'draw' && <p className="responds" style={{ margin: 0 }}>Draw across the top panel. The FFT recomputes the moment you lift the pointer.</p>}
          {preset === 'sum' && (
            <ControlGroup title="Sinusoids">
              <div className="comp-list">
                {comps.map((c, i) => (
                  <div className="comp" key={i}>
                    <div className="comp-head">
                      <span>
                        <i className="comp-swatch" style={{ background: COLORS[i % COLORS.length] }} />
                        Component {i + 1}
                      </span>
                      {comps.length > 1 && (
                        <button type="button" className="chip" onClick={() => setComps((cs) => cs.filter((_, k) => k !== i))}>
                          Remove
                        </button>
                      )}
                    </div>
                    <Slider label="Frequency" value={c.freq} min={1} max={60} step={1} onChange={(v) => updateComp(i, { freq: Math.round(v) })} format={(v) => `${Math.round(v)} cycles`} />
                    <Slider label="Amplitude" value={c.amp} min={0} max={1} step={0.01} onChange={(v) => updateComp(i, { amp: v })} format={(v) => fix(v, 2)} />
                    <Slider label="Phase" value={c.phase} min={-Math.PI} max={Math.PI} step={0.01} onChange={(v) => updateComp(i, { phase: v })} format={(v) => `${fix((v * 180) / Math.PI, 0)}°`} />
                  </div>
                ))}
              </div>
              {comps.length < 6 && (
                <Btn onClick={() => setComps((cs) => [...cs, { freq: 5 + cs.length * 4, amp: 0.3, phase: 0 }])}>+ Add a sinusoid</Btn>
              )}
            </ControlGroup>
          )}
          <ControlGroup title="Reconstruction & filtering">
            <Slider label="Components kept" value={terms} min={1} max={120} step={1} onChange={(v) => setTerms(Math.round(v))} format={(v) => String(Math.round(v))} tip="Rebuild the signal from only the strongest components — partial Fourier sums." />
            <Segmented
              label="Filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'none', label: 'None' },
                { value: 'low', label: 'Low-pass' },
                { value: 'high', label: 'High-pass' },
                { value: 'band', label: 'Band-pass' },
              ]}
            />
            {filter !== 'none' && (
              <>
                <Slider label={filter === 'band' ? 'Lower cutoff' : 'Cutoff'} value={cut[0]} min={0} max={KMAX} step={1} onChange={(v) => setCut(([, b]) => [Math.round(v), b])} format={(v) => `k = ${Math.round(v)}`} />
                {filter === 'band' && <Slider label="Upper cutoff" value={cut[1]} min={0} max={KMAX} step={1} onChange={(v) => setCut(([a]) => [a, Math.round(v)])} format={(v) => `k = ${Math.round(v)}`} />}
                <p className="responds" style={{ margin: 0 }}>You can also drag the pink handles on the spectrum.</p>
              </>
            )}
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'samples N (FFT size)', value: `${N}` },
            { label: 'strongest frequency', value: `k = ${domK}, A = ${fix(amp[domK], 3)}` },
            { label: 'energy kept (Parseval)', value: `${fix((eKept / Math.max(eTotal, 1e-12)) * 100, 2)}%`, accent: true },
            { label: 'RMS reconstruction error', value: fix(rms, 4) },
            { label: 'components shown', value: `${kept.length}` },
            { label: 'filtered signal RMS', value: fix(Math.sqrt(energy(filteredFull) / N), 4) },
          ]}
        />
      }
    />
  );
}
