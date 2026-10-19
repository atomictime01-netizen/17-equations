import { useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider } from '../components/Controls';
import { useCanvas, useReducedMotion } from '../core/hooks';
import { FONT_MONO, FONT_SERIF, text } from '../core/draw';
import { C_LIGHT } from '../math/em';
import { clamp, fix, mulberry32, sci } from '../math/rng';

const C2 = C_LIGHT * C_LIGHT;
const TNT_T = 4.184e9; // J per tonne of TNT (definition)
const KWH = 3.6e6;

/** Approximate, order-of-magnitude reference energies (J). */
const SCALES = [
  { e: 4.184e3, label: 'Food Calorie (1 kcal)', note: 'definition' },
  { e: 9e3, label: 'AA alkaline battery', note: '≈ 2.5 Wh' },
  { e: 3.4e7, label: 'Burning 1 litre of petrol', note: '≈ 34 MJ' },
  { e: 1e9, label: 'Lightning flash', note: 'order of 1 GJ' },
  { e: 4.184e9, label: '1 tonne of TNT', note: 'definition' },
  { e: 3.8e10, label: 'A US home’s electricity for a year', note: '≈ 10 500 kWh' },
  { e: 6.3e13, label: 'Hiroshima bomb (≈ 15 kt)', note: 'estimates 13–18 kt' },
  { e: 2.1e17, label: 'Largest nuclear test (≈ 50 Mt)', note: '1961' },
  { e: 6.2e20, label: 'World primary energy use, one year', note: '≈ 620 EJ (2023)' },
  { e: 3.8e26, label: 'The Sun’s output in one second', note: 'L☉ = 3.83 × 10²⁶ W' },
];

const PROCESSES = [
  { id: 'all', label: 'Full rest energy', frac: 1, note: 'The whole mc². Only matter–antimatter annihilation releases it all (and needs the antimatter too).' },
  { id: 'fusion', label: 'Fusion (D–T)', frac: 0.00375, note: 'Deuterium–tritium fusion converts ≈ 0.38% of the fuel mass (17.6 MeV per reaction). The Sun’s proton–proton chain converts ≈ 0.7%.' },
  { id: 'fission', label: 'Fission (U-235)', frac: 0.00091, note: 'Splitting uranium-235 converts ≈ 0.09% of its mass (≈ 200 MeV per fission).' },
  { id: 'chemical', label: 'Burning petrol', frac: 5.1e-10, note: 'Chemical energy is also mass–energy, but the mass change is only ≈ 5 × 10⁻¹⁰ of the fuel — far too small to weigh.' },
] as const;

/** Label directions around the rings, spread so neighbouring scales do not collide. */
const LABEL_ANGLES = [-2.6, -0.5, 2.55, 0.6, -2.05, -1.05, 2.0, 1.15, -1.55, -0.2];

type Unit = 'kg' | 'g' | 'mg' | 'µg' | 't';
const UNIT: Record<Unit, number> = { t: 1000, kg: 1, g: 1e-3, mg: 1e-6, µg: 1e-9 };

function tntLabel(e: number) {
  const t = e / TNT_T;
  if (t >= 1e9) return `${fix(t / 1e9, 2)} Gt TNT`;
  if (t >= 1e6) return `${fix(t / 1e6, 2)} Mt TNT`;
  if (t >= 1e3) return `${fix(t / 1e3, 2)} kt TNT`;
  if (t >= 1) return `${fix(t, 2)} t TNT`;
  return `${sci(t * 1000, 2)} kg TNT`;
}
function durationLabel(s: number) {
  if (s < 1e-3) return `${sci(s, 2)} s`;
  if (s < 120) return `${fix(s, 2)} s`;
  if (s < 7200) return `${fix(s / 60, 1)} min`;
  if (s < 172800) return `${fix(s / 3600, 1)} h`;
  if (s < 3.15e7 * 2) return `${fix(s / 86400, 1)} days`;
  return `${fix(s / 3.156e7, 1)} years`;
}

export default function Relativity() {
  const reduced = useReducedMotion();
  const [mKg, setMKg] = useState(2.5e-4);
  const [unit, setUnit] = useState<Unit>('g');
  const [proc, setProc] = useState<(typeof PROCESSES)[number]['id']>('all');
  const [procsSeen, setProcsSeen] = useState<Set<string>>(new Set(['all']));
  const [beta, setBeta] = useState(0);
  const burst = useRef<{ t0: number; frac: number } | null>(null);
  const shown = useRef(Math.log10(2.5e-4 * C2));
  const stars = useMemo(() => {
    const r = mulberry32(13);
    return Array.from({ length: 300 }, () => [r(), r(), r()]);
  }, []);

  const E = mKg * C2;
  const P = PROCESSES.find((p) => p.id === proc)!;
  const usable = E * P.frac;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const Etot = gamma * E;
  const pc = gamma * mKg * beta * C_LIGHT * C_LIGHT; // p·c in joules

  const tntKt = E / TNT_T / 1000;
  useGoalWhen('emc-gram', Math.abs(mKg - 1e-3) / 1e-3 < 0.02);
  useGoalWhen('emc-hiro', tntKt >= 12 && tntKt <= 18);
  useGoalWhen('emc-process', procsSeen.size >= 3);

  const LOGMIN = 3;
  const LOGMAX = 27;
  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt, time }) => {
      ctx.fillStyle = '#020309';
      ctx.fillRect(0, 0, w, h);
      for (const [sx, sy, sz] of stars) {
        ctx.fillStyle = `rgba(210,220,255,${0.12 + 0.35 * sz})`;
        ctx.fillRect(sx * w, sy * h, sz * 1.4 + 0.3, sz * 1.4 + 0.3);
      }
      const mob = w < 700;
      const top = mob ? 110 : 140;
      const cx = w * (mob ? 0.5 : 0.46);
      const cy = top + (h - top - 60) / 2;
      const Rmax = Math.min(mob ? w * 0.46 : w * 0.4, (h - top - 70) / 2);
      const radius = (logE: number) => 6 + ((clamp(logE, LOGMIN, LOGMAX) - LOGMIN) / (LOGMAX - LOGMIN)) * (Rmax - 6);
      const target = Math.log10(Math.max(usable, 1e-30));
      shown.current += (target - shown.current) * Math.min(1, dt * (reduced ? 30 : 4));
      const R = radius(shown.current);
      // energy glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(255,250,230,0.95)');
      g.addColorStop(0.08, 'rgba(255,220,150,0.55)');
      g.addColorStop(0.45, 'rgba(255,154,60,0.18)');
      g.addColorStop(0.85, 'rgba(138,216,255,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // shimmering edge
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,140,0.65)';
      ctx.shadowColor = '#ff9a3c';
      ctx.shadowBlur = 24;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let a = 0; a <= 120; a++) {
        const th = (a / 120) * Math.PI * 2;
        const rr = R * (1 + (reduced ? 0 : 0.012 * Math.sin(th * 7 + time * 2)));
        const x = cx + rr * Math.cos(th);
        const y = cy + rr * Math.sin(th);
        if (a) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      // reference rings
      SCALES.forEach((s, i) => {
        const r = radius(Math.log10(s.e));
        const reached = usable >= s.e;
        ctx.strokeStyle = reached ? 'rgba(255,214,140,0.55)' : 'rgba(140,170,255,0.18)';
        ctx.setLineDash(reached ? [] : [2, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const ang = LABEL_ANGLES[i % LABEL_ANGLES.length];
        const lx = cx + r * Math.cos(ang);
        const ly = cy + r * Math.sin(ang);
        if (!mob || i % 2 === 0)
          text(ctx, s.label, lx + (Math.cos(ang) > 0 ? 6 : -6), ly, {
            align: Math.cos(ang) > 0 ? 'left' : 'right',
            size: mob ? 9.5 : 11,
            color: reached ? 'rgba(255,225,170,0.95)' : 'rgba(170,185,230,0.6)',
            shadow: true,
          });
      });
      // the mass itself — a tiny bright speck
      const ms = clamp(1.5 + Math.log10(mKg + 1e-12) * 0.6 + 7, 1.5, 9);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#fff3c4';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, ms, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // conversion burst
      const b = burst.current;
      if (b) {
        const t = (performance.now() - b.t0) / 1000;
        const n = Math.round(40 + 220 * Math.min(1, 0.15 + Math.log10(1 + b.frac * 1e10) / 10));
        const rnd = mulberry32(99);
        for (let k = 0; k < n; k++) {
          const a = rnd() * Math.PI * 2;
          const sp = 0.5 + rnd();
          const r = t * sp * Rmax * 0.9;
          if (r > Rmax * 1.2) continue;
          ctx.fillStyle = `rgba(255,${200 + rnd() * 55},${120 + rnd() * 120},${Math.max(0, 1 - t / 1.6)})`;
          ctx.fillRect(cx + r * Math.cos(a), cy + r * Math.sin(a), 2, 2);
        }
        if (t > 1.8) burst.current = null;
      }
      text(ctx, `${sci(usable, 3)} J`, cx, cy + Math.min(R, Rmax) * 0.55 + 22, { align: 'center', size: mob ? 16 : 20, color: '#fff3c4', font: FONT_MONO, shadow: true });
      text(ctx, proc === 'all' ? 'rest energy E = mc²' : `released by ${P.label.toLowerCase()}`, cx, cy + Math.min(R, Rmax) * 0.55 + 42, { align: 'center', size: 12, color: 'rgba(255,225,170,0.75)', font: FONT_SERIF, italic: true, shadow: true });
    },
    { animate: true },
  );

  const reset = () => {
    setMKg(2.5e-4);
    setUnit('g');
    setProc('all');
    setBeta(0);
  };
  const dispMass = mKg / UNIT[unit];

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="A small mass at the centre surrounded by a sphere representing its energy on a logarithmic scale" />}
      onReset={reset}
      toolbar={
        <Btn onClick={() => (burst.current = { t0: performance.now(), frac: P.frac })} icon={Icon.play} variant="primary">
          Convert
        </Btn>
      }
      notice={
        <Callout tone={proc === 'all' ? 'warn' : 'info'}>
          {P.note}
        </Callout>
      }
      controls={
        <>
          <ControlGroup title="Mass">
            <Slider
              label="Mass"
              tex="m"
              value={mKg}
              min={1e-12}
              max={1e10}
              log
              onChange={setMKg}
              format={() => `${dispMass >= 1e4 || dispMass < 1e-3 ? sci(dispMass, 3) : fix(dispMass, dispMass < 10 ? 3 : 1)} ${unit}`}
            />
            <Segmented
              small
              label="Unit"
              value={unit}
              onChange={setUnit}
              options={(['µg', 'mg', 'g', 'kg', 't'] as Unit[]).map((u) => ({ value: u, label: u }))}
            />
            <div className="btn-row">
              <Btn onClick={() => setMKg(1e-3)}>1 gram</Btn>
              <Btn onClick={() => setMKg(9.1093837e-31)}>1 electron</Btn>
              <Btn onClick={() => setMKg(0.7e-3)}>0.7 g</Btn>
              <Btn onClick={() => setMKg(70)}>A person</Btn>
            </div>
          </ControlGroup>
          <ControlGroup title="How much is released?">
            <Segmented
              value={proc}
              onChange={(v) => {
                setProc(v);
                setProcsSeen((s) => new Set([...s, v]));
              }}
              options={PROCESSES.map((p) => ({ value: p.id, label: p.label }))}
            />
          </ControlGroup>
          <ControlGroup title="Moving mass (optional)">
            <Slider label="Speed" tex="v/c" value={beta} min={0} max={0.99} step={0.001} onChange={setBeta} format={(v) => fix(v, 3)} tip="E = γmc² for a moving body; E = mc² is the rest energy. Note E² = (pc)² + (mc²)²." />
          </ControlGroup>
          <ul className="scale-list" aria-label="Reference energies">
            {SCALES.map((s) => (
              <li key={s.label} className={usable >= s.e ? 'reached' : ''}>
                <span>{s.label}</span>
                <b>{sci(s.e, 2)} J</b>
              </li>
            ))}
          </ul>
          <p className="source-note">
            Reference values are approximate and rounded: TNT equivalence by definition (4.184 GJ/t); world energy ≈ 620 EJ (Energy Institute Statistical Review, 2023 data); solar luminosity
            3.828 × 10²⁶ W (IAU nominal); US household ≈ 10 500 kWh/yr (EIA).
          </p>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'rest energy mc²', value: `${sci(E, 4)} J`, accent: true },
            { label: 'in kilowatt-hours', value: `${sci(E / KWH, 3)} kWh` },
            { label: 'in electronvolts', value: `${sci(E / 1.602176634e-19, 4)} eV` },
            { label: 'TNT equivalent', value: tntLabel(E) },
            { label: `released (${P.label})`, value: `${sci(usable, 3)} J`, accent: proc !== 'all' },
            { label: 'world energy use for', value: durationLabel(usable / (6.2e20 / 3.156e7)) },
            { label: 'γ (Lorentz factor)', value: fix(gamma, 4) },
            { label: 'total energy γmc²', value: `${sci(Etot, 4)} J` },
            { label: '√((pc)² + (mc²)²)', value: `${sci(Math.hypot(pc, E), 4)} J` },
          ]}
        />
      }
    />
  );
}
