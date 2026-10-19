import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { axes, FONT_MONO, mapper, text } from '../core/draw';
import { countNodes, evolve, gaussianPacket, HBAR2_2M, HBAR_EV_FS, infiniteWellEnergy, makeGrid, project, solveEigenstates } from '../math/quantum';
import { fix, fmt } from '../math/rng';

type Pot = 'infinite' | 'finite' | 'harmonic' | 'double' | 'barrier' | 'step';
type Mode = 'eigen' | 'superpose' | 'packet';
const CYAN = '#3df5ff';
const PINK = '#ff7ae0';
const PLANCK_EV_FS = 2 * Math.PI * HBAR_EV_FS;

interface PotParams {
  pot: Pot;
  V0: number; // eV (well depth / barrier height)
  width: number; // nm
  hw: number; // ħω, eV
}

function buildPotential(p: PotParams, mode: Mode) {
  const packet = mode === 'packet';
  const L = p.pot === 'infinite' ? 2 : p.pot === 'harmonic' ? 6 : packet ? 14 : 4;
  const n = packet ? 520 : 420;
  const grid = makeGrid(L, n);
  const V = new Float64Array(n);
  const mid = L / 2;
  for (let i = 0; i < n; i++) {
    const x = grid.x[i];
    switch (p.pot) {
      case 'infinite':
        V[i] = 0;
        break;
      case 'finite':
        V[i] = Math.abs(x - mid) < p.width / 2 ? 0 : p.V0;
        break;
      case 'harmonic':
        // V = ½ m ω² (x − mid)² = (ħω)² (x − mid)² / (4 ħ²/2m)
        V[i] = (p.hw * p.hw * (x - mid) ** 2) / (4 * HBAR2_2M);
        break;
      case 'double':
        V[i] = Math.abs(x - mid) < p.width / 2 ? p.V0 : 0;
        break;
      case 'barrier':
        V[i] = Math.abs(x - mid) < p.width / 2 ? p.V0 : 0;
        break;
      case 'step':
        V[i] = x > mid ? p.V0 : 0;
        break;
    }
  }
  return { grid, V, L };
}

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${(h * 180) / Math.PI + 180},${s}%,${l}%,${a})`;
}

export default function Schrodinger() {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('eigen');
  const [pp, setPP] = useState<PotParams>({ pot: 'infinite', V0: 0.6, width: 1.6, hw: 0.25 });
  const [sel, setSel] = useState(0);
  const [coef, setCoef] = useState([1, 0.8, 0, 0]);
  const [showRe, setShowRe] = useState(true);
  const [showDensity, setShowDensity] = useState(true);
  const [helix, setHelix] = useState(false);
  const [running, setRunning] = useState(!reduced);
  const [speed, setSpeed] = useState(4);
  const [k0, setK0] = useState(22);
  const [sigma, setSigma] = useState(0.45);
  const [launched, setLaunched] = useState(false);
  const tRef = useRef(0);
  const deferred = useDeferredValue(pp);
  const deferredMode = useDeferredValue(mode);

  const sys = useMemo(() => {
    const { grid, V, L } = buildPotential(deferred, deferredMode);
    const count = deferredMode === 'packet' ? 80 : 10;
    const es = solveEigenstates(grid, V, count);
    return { grid, V, L, es, pot: deferred.pot, mode: deferredMode };
  }, [deferred, deferredMode]);

  // initial state coefficients for the current mode
  const coeffs = useMemo(() => {
    const m = sys.es.states.length;
    const cr = new Float64Array(m);
    const ci = new Float64Array(m);
    let captured = 1;
    if (sys.mode === 'eigen') cr[Math.min(sel, m - 1)] = 1;
    else if (sys.mode === 'superpose') {
      const norm = Math.hypot(...coef) || 1;
      coef.forEach((c, i) => (cr[i] = c / norm));
    } else {
      const pk = gaussianPacket(sys.grid, sys.L * 0.22, sigma, k0);
      const pr = project(sys.es.states, pk.re, pk.im, sys.grid.h);
      cr.set(pr.cr);
      ci.set(pr.ci);
      captured = pr.captured;
    }
    return { cr, ci, captured };
  }, [sys, sel, coef, k0, sigma]);

  const psiRe = useRef(new Float64Array(600));
  const psiIm = useRef(new Float64Array(600));

  const E0packet = HBAR2_2M * k0 * k0;
  const energies = sys.es.energies;
  const transmitted = useThrottledValue(() => {
    if (sys.mode !== 'packet') return 0;
    const n = sys.grid.n;
    let s = 0;
    for (let i = 0; i < n; i++) if (sys.grid.x[i] > sys.L / 2 + (pp.pot === 'barrier' ? pp.width / 2 : 0)) s += (psiRe.current[i] ** 2 + psiIm.current[i] ** 2) * sys.grid.h;
    return s;
  }, 200);
  const tShown = useThrottledValue(() => tRef.current, 200);

  useGoalWhen('q-nodes', mode === 'eigen' && sel === 2);
  useGoalWhen('q-super', mode === 'superpose' && coef.filter((c) => Math.abs(c) > 0.05).length >= 2 && tShown > 5);
  useGoalWhen('q-tunnel', mode === 'packet' && pp.pot === 'barrier' && launched && E0packet < pp.V0 && transmitted > 0.01);

  const geom = (w: number, h: number) => {
    const mob = w < 700;
    const top = mob ? 118 : 150;
    // energy window
    let vmax = 0;
    for (let i = 0; i < sys.V.length; i++) vmax = Math.max(vmax, sys.V[i]);
    let emax: number;
    if (sys.mode === 'packet') emax = Math.max(E0packet * 1.9, pp.V0 * 1.25, 0.2);
    else {
      const topCoef = coef.reduce((m, c, i) => (Math.abs(c) > 0.01 ? i : m), 0);
      const idx = Math.min(energies.length - 1, sys.mode === 'eigen' ? sel + 2 : topCoef + 2);
      emax = energies[idx] * 1.15;
    }
    const emin = -emax * 0.08;
    return mapper({ x: mob ? 40 : 66, y: top, w: w - (mob ? 56 : 96), h: h - top - 64 }, [0, sys.L], [emin, emax]);
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const m = geom(w, h);
      const { grid, V, es } = sys;
      if (running && (sys.mode !== 'packet' || launched)) tRef.current += dt * speed;
      evolve(es, coeffs.cr, coeffs.ci, tRef.current, psiRe.current, psiIm.current);
      axes(ctx, m, { xLabel: 'x (nm)', yLabel: 'energy (eV)', fmtY: (v) => fix(v, 2) });
      // potential
      const Vcap = m.yr[1];
      ctx.beginPath();
      ctx.moveTo(m.X(0), m.Y(Vcap));
      for (let i = 0; i < grid.n; i++) ctx.lineTo(m.X(grid.x[i]), m.Y(Math.min(V[i], Vcap)));
      ctx.lineTo(m.X(sys.L), m.Y(Vcap));
      ctx.closePath();
      ctx.fillStyle = 'rgba(155,123,255,0.10)';
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < grid.n; i++) (i ? ctx.lineTo(m.X(grid.x[i]), m.Y(Math.min(V[i], Vcap))) : ctx.moveTo(m.X(grid.x[i]), m.Y(Math.min(V[i], Vcap))));
      ctx.strokeStyle = 'rgba(190,170,255,0.8)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // walls of the box
      ctx.fillStyle = 'rgba(190,170,255,0.25)';
      ctx.fillRect(m.X(0) - 6, m.rect.y, 6, m.rect.h);
      ctx.fillRect(m.X(sys.L), m.rect.y, 6, m.rect.h);
      // energy levels
      if (sys.mode !== 'packet') {
        for (let k = 0; k < energies.length; k++) {
          const e = energies[k];
          if (e > m.yr[1]) break;
          const on = sys.mode === 'eigen' ? k === sel : Math.abs(coef[k] ?? 0) > 0.01;
          ctx.strokeStyle = on ? 'rgba(61,245,255,0.75)' : 'rgba(200,210,255,0.22)';
          ctx.lineWidth = on ? 1.4 : 1;
          ctx.setLineDash(on ? [] : [4, 4]);
          ctx.beginPath();
          ctx.moveTo(m.rect.x, m.Y(e));
          ctx.lineTo(m.rect.x + m.rect.w, m.Y(e));
          ctx.stroke();
          ctx.setLineDash([]);
          text(ctx, `n=${k + 1}  ${fix(e, 3)} eV`, m.rect.x + m.rect.w - 4, m.Y(e) - 4, { align: 'right', size: 10, color: on ? CYAN : 'rgba(200,210,255,0.5)', font: FONT_MONO });
        }
      }
      // wavefunction
      let base: number;
      if (sys.mode === 'eigen') base = energies[sel];
      else if (sys.mode === 'superpose') {
        let num = 0;
        let den = 0;
        coef.forEach((c, i) => {
          num += c * c * energies[i];
          den += c * c;
        });
        base = den ? num / den : 0;
      } else base = E0packet;
      // fixed reference amplitude so spreading and tunnelling are visible (no per-frame rescaling)
      const Aref = sys.mode === 'packet' ? Math.pow(2 * Math.PI * sigma * sigma, -0.25) : Math.sqrt(2 / sys.L) * 1.3;
      const frac = sys.mode === 'packet' ? 0.3 : 0.2;
      const pxPerPsi = (frac * m.rect.h) / Aref;
      const by = m.Y(base);
      if (showDensity) {
        // |ψ|² coloured by phase arg(ψ)
        const wcol = Math.max(1.2, m.X(grid.x[1]) - m.X(grid.x[0]) + 0.6);
        for (let i = 0; i < grid.n; i++) {
          const re = psiRe.current[i];
          const im = psiIm.current[i];
          const hpx = ((re * re + im * im) / (Aref * Aref)) * frac * m.rect.h;
          ctx.fillStyle = sys.mode === 'eigen' ? 'rgba(255,122,224,0.45)' : hsl(Math.atan2(im, re), 90, 62, 0.75);
          ctx.fillRect(m.X(grid.x[i]) - wcol / 2, by - hpx, wcol, hpx);
        }
      }
      if (helix) {
        const ox = 0.5;
        const oy = 0.32;
        ctx.save();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = CYAN;
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i < grid.n; i++) {
          const re = psiRe.current[i] * pxPerPsi;
          const im = psiIm.current[i] * pxPerPsi;
          const x = m.X(grid.x[i]) + im * ox;
          const y = by - re + im * oy;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        text(ctx, '3-D: Re ψ up, Im ψ into depth', m.rect.x + 8, m.rect.y + 30, { size: 10.5, color: 'rgba(61,245,255,0.8)', font: FONT_MONO });
      } else if (showRe) {
        for (const [arr, col, wd] of [
          [psiIm.current, 'rgba(255,122,224,0.75)', 1.3],
          [psiRe.current, CYAN, 1.9],
        ] as [Float64Array, string, number][]) {
          if (sys.mode === 'eigen' && arr === psiIm.current) continue;
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < grid.n; i++) {
            const y = by - arr[i] * pxPerPsi;
            if (i) ctx.lineTo(m.X(grid.x[i]), y);
            else ctx.moveTo(m.X(grid.x[i]), y);
          }
          ctx.strokeStyle = col;
          ctx.lineWidth = wd;
          ctx.shadowColor = col;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
        }
      }
      text(ctx, `t = ${fix(tRef.current, 2)} fs`, m.rect.x + 8, m.rect.y + 14, { size: 11, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
    },
    { animate: true },
  );

  usePointer(canvasRef, {
    down: (p) => {
      if (mode !== 'eigen') return false;
      const el = canvasRef.current!;
      const m = geom(el.clientWidth, el.clientHeight);
      let best = -1;
      let bd = 14;
      energies.forEach((e, k) => {
        const d = Math.abs(m.Y(e) - p.y);
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      if (best < 0) return false;
      setSel(best);
    },
  });

  const choosePot = (pot: Pot) => {
    const defaults: Record<Pot, Partial<PotParams>> = {
      infinite: {},
      finite: { V0: 0.6, width: 1.6 },
      harmonic: { hw: 0.25 },
      double: { V0: 0.35, width: 0.3 },
      barrier: { V0: 0.12, width: 0.5 },
      step: { V0: 0.1 },
    };
    setPP((p) => ({ ...p, pot, ...defaults[pot] }));
    setSel(0);
    tRef.current = 0;
    setLaunched(false);
    if (pot === 'barrier' || pot === 'step') {
      setMode('packet');
      setSpeed(5);
      setK0(pot === 'barrier' ? 1.6 : 1.4);
      setSigma(0.9);
    }
  };

  const reset = () => {
    setMode('eigen');
    setPP({ pot: 'infinite', V0: 0.6, width: 1.6, hw: 0.25 });
    setSel(0);
    setCoef([1, 0.8, 0, 0]);
    setSpeed(4);
    setK0(22);
    setSigma(0.45);
    setLaunched(false);
    tRef.current = 0;
    setRunning(!reduced);
    setHelix(false);
  };

  const En = energies[Math.min(sel, energies.length - 1)] ?? 0;
  const analytic = pp.pot === 'infinite' ? infiniteWellEnergy(sel + 1, 2) : pp.pot === 'harmonic' ? pp.hw * (sel + 0.5) : NaN;
  const nodes = sys.es.states[sel] ? countNodes(sys.es.states[sel]) : 0;
  const nz = coef.map((c, i) => [c, i]).filter(([c]) => Math.abs(c) > 0.01);
  const dE = nz.length >= 2 ? Math.abs(energies[nz[1][1]] - energies[nz[0][1]]) : 0;

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Potential energy curve with quantum energy levels and the wavefunction" />}
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Evolve'}
          </Btn>
          {mode === 'packet' && (
            <Btn
              variant="primary"
              onClick={() => {
                tRef.current = 0;
                setLaunched(true);
                setRunning(true);
              }}
            >
              Launch packet
            </Btn>
          )}
        </>
      }
      legend={
        <>
          <span className="legend-item"><i className="legend-swatch" style={{ background: CYAN }} /> Re ψ</span>
          {mode !== 'eigen' && <span className="legend-item"><i className="legend-swatch" style={{ background: PINK }} /> Im ψ</span>}
          <span className="legend-item"><i className="legend-swatch" style={{ background: 'linear-gradient(90deg,#f55,#ff5,#5f5,#5ff,#55f,#f5f)' }} /> |ψ|², hue = phase</span>
        </>
      }
      notice={
        mode === 'packet' && pp.pot === 'barrier' && E0packet < pp.V0 ? (
          <Callout tone="event">
            Packet energy {fix(E0packet, 3)} eV is <strong>below</strong> the {fix(pp.V0, 2)} eV barrier — classically it must bounce back. Transmitted so far: {fix(transmitted * 100, 1)}%.
          </Callout>
        ) : mode === 'eigen' ? (
          <Callout tone="info">
            State n = {sel + 1} has <strong>{nodes}</strong> node{nodes === 1 ? '' : 's'}. Click another level to select it.
          </Callout>
        ) : mode === 'superpose' && dE > 0 ? (
          <Callout tone="info">|ψ|² sloshes with period h/ΔE = {fix(PLANCK_EV_FS / dE, 2)} fs.</Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="Potential"
            value={pp.pot}
            onChange={choosePot}
            options={[
              { value: 'infinite', label: 'Infinite well' },
              { value: 'finite', label: 'Finite well' },
              { value: 'harmonic', label: 'Harmonic' },
              { value: 'double', label: 'Double well' },
              { value: 'barrier', label: 'Barrier' },
              { value: 'step', label: 'Step' },
            ]}
          />
          <Segmented
            label="State"
            value={mode}
            onChange={(v) => {
              setMode(v);
              tRef.current = 0;
              setLaunched(false);
              if (v === 'packet') {
                setSpeed(5);
                if (pp.pot !== 'barrier' && pp.pot !== 'step') choosePot('barrier');
              } else {
                setSpeed(4);
                if (pp.pot === 'barrier' || pp.pot === 'step') setPP((p) => ({ ...p, pot: 'infinite' }));
              }
            }}
            options={[
              { value: 'eigen', label: 'Eigenstate' },
              { value: 'superpose', label: 'Superposition' },
              { value: 'packet', label: 'Wave packet' },
            ]}
          />
          <ControlGroup title="Potential shape">
            {(pp.pot === 'finite' || pp.pot === 'double' || pp.pot === 'barrier' || pp.pot === 'step') && (
              <Slider label={pp.pot === 'finite' ? 'Well depth' : 'Barrier height'} tex="V_0" value={pp.V0} min={0.02} max={pp.pot === 'finite' ? 2 : 1} step={0.005} onChange={(v) => setPP((p) => ({ ...p, V0: v }))} format={(v) => fix(v, 3)} unit="eV" />
            )}
            {(pp.pot === 'finite' || pp.pot === 'double' || pp.pot === 'barrier') && (
              <Slider label={pp.pot === 'finite' ? 'Well width' : 'Barrier width'} value={pp.width} min={0.1} max={pp.pot === 'finite' ? 3.5 : 1.5} step={0.01} onChange={(v) => setPP((p) => ({ ...p, width: v }))} format={(v) => fix(v, 2)} unit="nm" />
            )}
            {pp.pot === 'harmonic' && <Slider label="Oscillator quantum" tex="\hbar\omega" value={pp.hw} min={0.05} max={0.6} step={0.005} onChange={(v) => setPP((p) => ({ ...p, hw: v }))} format={(v) => fix(v, 3)} unit="eV" />}
            {pp.pot === 'infinite' && <p className="responds" style={{ margin: 0 }}>An electron confined to a 2 nm box with impenetrable walls.</p>}
          </ControlGroup>
          {mode === 'eigen' && (
            <ControlGroup title="Eigenstate">
              <Slider label="Quantum number" tex="n" value={sel + 1} min={1} max={energies.length} step={1} onChange={(v) => setSel(Math.round(v) - 1)} format={(v) => String(Math.round(v))} />
            </ControlGroup>
          )}
          {mode === 'superpose' && (
            <ControlGroup title="Amplitudes (normalised automatically)">
              {coef.map((c, i) => (
                <Slider key={i} label={`c${i + 1} for ψ${i + 1}`} value={c} min={0} max={1} step={0.01} onChange={(v) => setCoef((cs) => cs.map((x, k) => (k === i ? v : x)))} format={(v) => fix(v, 2)} />
              ))}
            </ControlGroup>
          )}
          {mode === 'packet' && (
            <ControlGroup title="Wave packet">
              <Slider label="Wavenumber" tex="k_0" value={k0} min={0.5} max={4} step={0.01} onChange={(v) => { setK0(v); setLaunched(false); tRef.current = 0; }} format={(v) => fix(v, 2)} unit="nm⁻¹" tip="Mean kinetic energy E = ħ²k₀²/2m." />
              <Slider label="Width" tex="\sigma" value={sigma} min={0.4} max={1.6} step={0.01} onChange={(v) => { setSigma(v); setLaunched(false); tRef.current = 0; }} format={(v) => fix(v, 2)} unit="nm" />
            </ControlGroup>
          )}
          <ControlGroup title="Display">
            <div className="toggle-row">
              <Toggle label="Re/Im ψ" checked={showRe} onChange={setShowRe} />
              <Toggle label="|ψ|²" checked={showDensity} onChange={setShowDensity} />
              <Toggle label="3-D helix" checked={helix} onChange={setHelix} />
            </div>
            <Slider label="Time speed" value={speed} min={0.05} max={30} log onChange={setSpeed} format={(v) => fix(v, 2)} unit="fs/s" />
          </ControlGroup>
        </>
      }
      readouts={
        mode === 'eigen' ? (
          <Readouts
            items={[
              { label: `E${sel + 1} (numerical)`, value: `${fix(En, 5)} eV`, accent: true },
              { label: 'analytic', value: Number.isFinite(analytic) ? `${fix(analytic, 5)} eV` : 'no closed form' },
              { label: 'nodes', value: String(nodes) },
              { label: 'grid points', value: String(sys.grid.n) },
            ]}
          />
        ) : mode === 'superpose' ? (
          <Readouts
            items={[
              { label: 'ΔE between first two', value: dE ? `${fix(dE, 4)} eV` : '—' },
              { label: 'slosh period h/ΔE', value: dE ? `${fix(PLANCK_EV_FS / dE, 3)} fs` : '—', accent: true },
              { label: 'time', value: `${fix(tShown, 2)} fs` },
              { label: 'norm ∫|ψ|²dx', value: '1.000' },
            ]}
          />
        ) : (
          <Readouts
            items={[
              { label: 'packet energy ħ²k₀²/2m', value: `${fix(E0packet, 4)} eV`, accent: true },
              { label: 'barrier/step height', value: `${fix(pp.V0, 3)} eV` },
              { label: 'probability beyond', value: `${fix(transmitted * 100, 2)}%`, accent: true },
              { label: 'basis completeness', value: `${fix(coeffs.captured * 100, 2)}%`, hint: 'Fraction of the packet represented by the computed eigenstates' },
              { label: 'group speed ħk/m', value: `${fix((2 * HBAR2_2M * k0) / HBAR_EV_FS, 3)} nm/fs` },
              { label: 'eigenstates used', value: fmt(sys.es.states.length, 3) },
            ]}
          />
        )
      }
    />
  );
}

