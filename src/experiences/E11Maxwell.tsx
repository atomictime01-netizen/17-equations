import { useEffect, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { Tex } from '../components/Tex';
import { useCanvas, usePointer, useReducedMotion } from '../core/hooks';
import { arrow, contourSegments, dot, FONT_MONO, FONT_SERIF, handle, text } from '../core/draw';
import { bField, C_LIGHT, circleCirculation, circleFlux, eField, ePotential, EPS0, inducedE, MU0, Yee1D, type LineCharge, type Wire } from '../math/em';
import { clamp, fix, fmt, sci } from '../math/rng';

type Scene = 'gauss' | 'magnet' | 'faraday' | 'wave';
const YEL = '#ffcf4a';
const BLUE = '#4aa8ff';
const RED = '#ff5f6d';

const CHIPS: { scene: Scene; name: string; tex: string }[] = [
  { scene: 'gauss', name: 'Gauss (electric)', tex: '\\nabla\\cdot\\mathbf{E}=\\rho/\\varepsilon_0' },
  { scene: 'magnet', name: 'Gauss (magnetic)', tex: '\\nabla\\cdot\\mathbf{B}=0' },
  { scene: 'faraday', name: 'Faraday', tex: '\\nabla\\times\\mathbf{E}=-\\partial_t\\mathbf{B}' },
  { scene: 'wave', name: 'Ampère–Maxwell', tex: '\\nabla\\times\\mathbf{B}=\\mu_0\\mathbf{J}+\\mu_0\\varepsilon_0\\partial_t\\mathbf{E}' },
];

const EXAMPLES = [
  { label: 'FM radio', f: 100e6 },
  { label: 'Wi-Fi', f: 2.4e9 },
  { label: 'Microwave oven', f: 2.45e9 },
  { label: 'Green light', f: 5.6e14 },
  { label: 'X-ray', f: 3e18 },
];

export default function Maxwell() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState<Scene>('gauss');
  const [charges, setCharges] = useState<LineCharge[]>([
    { x: -0.45, y: 0, q: 2 },
    { x: 0.45, y: 0, q: -2 },
    { x: 0.2, y: 0.75, q: 1 },
  ]);
  const [wires, setWires] = useState<Wire[]>([
    { x: -0.35, y: 0, I: 5 },
    { x: 0.5, y: 0.2, I: -3 },
  ]);
  const [loop, setLoop] = useState({ x: -0.3, y: 0, r: 0.55 });
  const [showEquip, setShowEquip] = useState(false);
  const [loopMoved, setLoopMoved] = useState({ gauss: false, magnet: false });
  // Faraday
  const [B0, setB0] = useState(0.8);
  const [fF, setFF] = useState(0.5);
  const [Rloop, setRloop] = useState(0.55);
  const faraday = useRef({ hist: [] as { t: number; phi: number; emf: number }[] });
  // wave
  const [lambdaCells, setLambdaCells] = useState(60);
  const [epsR, setEpsR] = useState(2.25);
  const [muR, setMuR] = useState(1);
  const [displacement, setDisplacement] = useState(true);
  const [running, setRunning] = useState(!reduced);
  const [example, setExample] = useState(0);
  const yee = useRef(new Yee1D(420));
  const drag = useRef<null | { kind: 'charge' | 'wire'; i: number } | { kind: 'loop' } | { kind: 'radius' }>(null);
  const timeRef = useRef(0);

  useGoalWhen('mx-gauss', loopMoved.gauss);
  useGoalWhen('mx-ampere', loopMoved.magnet && wires.some((w) => Math.hypot(w.x - loop.x, w.y - loop.y) < loop.r));
  useGoalWhen('mx-disp', scene === 'wave' && !displacement);

  // medium slab for the wave scene
  useEffect(() => {
    const y = yee.current;
    for (let i = 0; i < y.n; i++) {
      const inSlab = i >= 230 && i < 330;
      y.epsR[i] = inSlab ? epsR : 1;
      y.muR[i] = inSlab ? muR : 1;
    }
  }, [epsR, muR]);

  const geom = (w: number, h: number) => {
    const mob = w < 700;
    const top = mob ? 110 : 150;
    const availH = h - top - 60;
    const cx = w / 2;
    const cy = top + availH / 2;
    const s = Math.min(w / 3.6, availH / 2.3);
    return { cx, cy, s, X: (x: number) => cx + x * s, Y: (y: number) => cy - y * s, inv: (px: number, py: number) => [(px - cx) / s, (cy - py) / s] as [number, number], top, mob };
  };

  // cache expensive field-line geometry per configuration
  const cache = useRef<{ key: string; paths: number[][]; contours: number[]; dims: number[] } | null>(null);

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const g = geom(w, h);
      if (running) timeRef.current += dt;
      if (scene === 'gauss') drawGauss(ctx, w, h, g);
      else if (scene === 'magnet') drawMagnet(ctx, w, h, g);
      else if (scene === 'faraday') drawFaraday(ctx, w, h, g);
      else drawWave(ctx, w, h, g);
    },
    { animate: true },
  );
  type G = ReturnType<typeof geom>;

  function traceELines(g: G, w: number, h: number) {
    const key = `E|${w}|${h}|${JSON.stringify(charges)}|${showEquip}`;
    if (cache.current?.key === key) return cache.current;
    const paths: number[][] = [];
    const xmin = -2.2;
    const xmax = 2.2;
    const ymin = -1.6;
    const ymax = 1.6;
    const total = charges.reduce((s, c) => s + c.q, 0);
    const starts = charges.filter((c) => (total >= 0 ? c.q > 0 : c.q < 0));
    for (const c of starts) {
      const nLines = Math.round(Math.abs(c.q) * 7);
      for (let k = 0; k < nLines; k++) {
        const a = (2 * Math.PI * (k + 0.5)) / nLines;
        let x = c.x + 0.04 * Math.cos(a);
        let y = c.y + 0.04 * Math.sin(a);
        const dir = c.q > 0 ? 1 : -1;
        const pts = [x, y];
        for (let step = 0; step < 900; step++) {
          const f = (px: number, py: number) => {
            const [ex, ey] = eField(charges, px, py);
            const m = Math.hypot(ex, ey) || 1;
            return [(dir * ex) / m, (dir * ey) / m];
          };
          const hs = 0.012;
          const [k1x, k1y] = f(x, y);
          const [k2x, k2y] = f(x + (hs / 2) * k1x, y + (hs / 2) * k1y);
          const [k3x, k3y] = f(x + (hs / 2) * k2x, y + (hs / 2) * k2y);
          const [k4x, k4y] = f(x + hs * k3x, y + hs * k3y);
          x += (hs / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
          y += (hs / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
          pts.push(x, y);
          if (x < xmin || x > xmax || y < ymin || y > ymax) break;
          if (charges.some((o) => Math.sign(o.q) === -dir && Math.hypot(o.x - x, o.y - y) < 0.03)) break;
        }
        paths.push(pts);
      }
    }
    let contours: number[] = [];
    const dims: number[] = [];
    if (showEquip) {
      const gw = 120;
      const gh = Math.round((gw * (h - g.top)) / w);
      const vals = new Float64Array((gw + 1) * (gh + 1));
      for (let j = 0; j <= gh; j++)
        for (let i = 0; i <= gw; i++) {
          const [x, y] = g.inv((i / gw) * w, g.top + (j / gh) * (h - g.top));
          vals[j * (gw + 1) + i] = ePotential(charges, x, y);
        }
      const step = 6;
      for (let L = -60; L <= 60; L += step) contours = contours.concat(contourSegments(vals, gw, gh, L).map((v, idx) => (idx % 2 === 0 ? (v / gw) * w : g.top + (v / gh) * (h - g.top))));
      dims.push(gw, gh);
    }
    cache.current = { key, paths, contours, dims };
    return cache.current;
  }

  function drawLoop(ctx: CanvasRenderingContext2D, g: G, col: string) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(g.X(loop.x), g.Y(loop.y), loop.r * g.s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    handle(ctx, g.X(loop.x), g.Y(loop.y), col, drag.current?.kind === 'loop');
    handle(ctx, g.X(loop.x + loop.r), g.Y(loop.y), col, drag.current?.kind === 'radius');
  }

  function drawGauss(ctx: CanvasRenderingContext2D, w: number, h: number, g: G) {
    const { paths, contours } = traceELines(g, w, h);
    if (showEquip) {
      ctx.strokeStyle = 'rgba(74,168,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < contours.length; i += 4) {
        ctx.moveTo(contours[i], contours[i + 1]);
        ctx.lineTo(contours[i + 2], contours[i + 3]);
      }
      ctx.stroke();
    }
    const t = timeRef.current;
    for (const p of paths) {
      ctx.beginPath();
      for (let i = 0; i < p.length; i += 2) (i ? ctx.lineTo(g.X(p[i]), g.Y(p[i + 1])) : ctx.moveTo(g.X(p[i]), g.Y(p[i + 1])));
      ctx.strokeStyle = 'rgba(255,207,74,0.55)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // flowing sparks show the field direction
      if (!reduced) {
        const nPts = p.length / 2;
        for (let s = (t * 40) % 30; s < nPts; s += 30) {
          const i = Math.floor(s) * 2;
          dot(ctx, g.X(p[i]), g.Y(p[i + 1]), 1.8, '#fff6c4');
        }
      }
    }
    drawLoop(ctx, g, '#7dffaa');
    for (const c of charges) {
      const col = c.q > 0 ? RED : BLUE;
      const r = 9 + 3 * Math.abs(c.q);
      const gr = ctx.createRadialGradient(g.X(c.x), g.Y(c.y), 0, g.X(c.x), g.Y(c.y), r * 2.4);
      gr.addColorStop(0, '#fff');
      gr.addColorStop(0.35, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(g.X(c.x), g.Y(c.y), r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, c.q > 0 ? '+' : '−', g.X(c.x), g.Y(c.y) + 1, { align: 'center', baseline: 'middle', size: 18, weight: 700, color: '#fff' });
      text(ctx, `${c.q > 0 ? '+' : ''}${fix(c.q, 1)} nC/m`, g.X(c.x), g.Y(c.y) + r + 16, { align: 'center', size: 10.5, color: 'rgba(230,235,255,0.8)', font: FONT_MONO });
    }
  }

  function drawMagnet(ctx: CanvasRenderingContext2D, w: number, h: number, g: G) {
    const key = `B|${w}|${h}|${JSON.stringify(wires)}`;
    if (cache.current?.key !== key) {
      const gw = g.mob ? 90 : 140;
      const gh = Math.round((gw * (h - g.top)) / w);
      const vals = new Float64Array((gw + 1) * (gh + 1));
      for (let j = 0; j <= gh; j++)
        for (let i = 0; i <= gw; i++) {
          const [x, y] = g.inv((i / gw) * w, g.top + (j / gh) * (h - g.top));
          // A_z = −(μ0/2π) Σ I ln r ; its contours are exactly the B field lines
          let A = 0;
          for (const wr of wires) A -= wr.I * Math.log(Math.hypot(x - wr.x, y - wr.y) + 1e-6);
          vals[j * (gw + 1) + i] = A;
        }
      let segs: number[] = [];
      const maxI = Math.max(...wires.map((wr) => Math.abs(wr.I)), 1);
      const step = maxI / 3.2;
      for (let L = -30 * maxI; L <= 30 * maxI; L += step) segs = segs.concat(contourSegments(vals, gw, gh, L).map((v, idx) => (idx % 2 === 0 ? (v / gw) * w : g.top + (v / gh) * (h - g.top))));
      cache.current = { key, paths: [], contours: segs, dims: [gw, gh] };
    }
    const segs = cache.current.contours;
    ctx.strokeStyle = 'rgba(74,168,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < segs.length; i += 4) {
      ctx.moveTo(segs[i], segs[i + 1]);
      ctx.lineTo(segs[i + 2], segs[i + 3]);
    }
    ctx.stroke();
    // direction arrows on a coarse grid
    for (let py = g.top + 20; py < h - 40; py += 46)
      for (let px = 20; px < w - 20; px += 46) {
        const [x, y] = g.inv(px, py);
        if (wires.some((wr) => Math.hypot(wr.x - x, wr.y - y) < 0.12)) continue;
        const [bx, by] = bField(wires, x, y);
        const m = Math.hypot(bx, by);
        if (m < 1e-9) continue;
        const L = clamp(6 + 3 * Math.log10(m / 1e-7), 4, 14);
        arrow(ctx, px - (bx / m) * L * 0.5, py + (by / m) * L * 0.5, px + (bx / m) * L * 0.5, py - (by / m) * L * 0.5, 'rgba(160,210,255,0.6)', 1, 4);
      }
    drawLoop(ctx, g, '#7dffaa');
    for (const wr of wires) {
      const r = 12;
      ctx.fillStyle = 'rgba(20,30,60,0.95)';
      ctx.strokeStyle = wr.I > 0 ? YEL : '#ff9a5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.X(wr.x), g.Y(wr.y), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (wr.I > 0) dot(ctx, g.X(wr.x), g.Y(wr.y), 3.5, YEL, 8);
      else {
        ctx.beginPath();
        ctx.moveTo(g.X(wr.x) - 5, g.Y(wr.y) - 5);
        ctx.lineTo(g.X(wr.x) + 5, g.Y(wr.y) + 5);
        ctx.moveTo(g.X(wr.x) + 5, g.Y(wr.y) - 5);
        ctx.lineTo(g.X(wr.x) - 5, g.Y(wr.y) + 5);
        ctx.stroke();
      }
      text(ctx, `${fix(wr.I, 1)} A ${wr.I > 0 ? '(out)' : '(in)'}`, g.X(wr.x), g.Y(wr.y) + 28, { align: 'center', size: 10.5, color: 'rgba(230,235,255,0.8)', font: FONT_MONO });
    }
  }

  function drawFaraday(ctx: CanvasRenderingContext2D, w: number, h: number, g: G) {
    const t = timeRef.current;
    const om = 2 * Math.PI * fF;
    const B = B0 * Math.sin(om * t);
    const dBdt = B0 * om * Math.cos(om * t);
    const a = 0.35;
    const cy = g.cy - (g.mob ? 20 : 30);
    const X = (x: number) => g.cx + x * g.s * 0.9;
    const Y = (y: number) => cy - y * g.s * 0.9;
    // solenoid cross-section with B in/out of the screen
    const col = B >= 0 ? YEL : BLUE;
    ctx.fillStyle = `rgba(${B >= 0 ? '255,207,74' : '74,168,255'},${0.08 + 0.18 * Math.abs(B) / Math.max(B0, 1e-6)})`;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), a * g.s * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    for (let yy = -a; yy <= a; yy += 0.12)
      for (let xx = -a; xx <= a; xx += 0.12) {
        if (xx * xx + yy * yy > a * a * 0.85) continue;
        const sz = 2 + 4 * (Math.abs(B) / Math.max(B0, 1e-6));
        if (B >= 0) dot(ctx, X(xx), Y(yy), sz * 0.6, col);
        else {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(X(xx) - sz, Y(yy) - sz);
          ctx.lineTo(X(xx) + sz, Y(yy) + sz);
          ctx.moveTo(X(xx) + sz, Y(yy) - sz);
          ctx.lineTo(X(xx) - sz, Y(yy) + sz);
          ctx.stroke();
        }
      }
    // induced electric field: circulating arrows
    const scaleE = 1 / Math.max(B0 * om * a * 0.5, 1e-6);
    for (const r of [0.2, 0.45, 0.7, 0.95, 1.2]) {
      const E = inducedE(r, a, dBdt);
      const nA = Math.round(6 + r * 10);
      for (let k = 0; k < nA; k++) {
        const th = (2 * Math.PI * k) / nA + t * 0.2;
        const px = X(r * Math.cos(th));
        const py = Y(r * Math.sin(th));
        const L = clamp(Math.abs(E) * scaleE * 22, 0, 26);
        const sgn = Math.sign(E);
        // tangential direction (counter-clockwise for positive E_φ)
        const tx = -Math.sin(th) * sgn;
        const ty = Math.cos(th) * sgn;
        if (L > 1) arrow(ctx, px - tx * L * 0.5, py + ty * L * 0.5, px + tx * L * 0.5, py - ty * L * 0.5, 'rgba(255,95,109,0.85)', 1.6, 6);
      }
    }
    // the pickup loop
    ctx.save();
    ctx.strokeStyle = '#7dffaa';
    ctx.shadowColor = '#7dffaa';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(X(0), Y(0), Rloop * g.s * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const area = Math.PI * Math.min(Rloop, a) ** 2;
    const phi = B * area;
    const emf = -dBdt * area;
    const hist = faraday.current.hist;
    if (running) {
      hist.push({ t, phi, emf });
      while (hist.length && hist[0].t < t - 4) hist.shift();
    }
    // strip chart
    const sx0 = g.mob ? 16 : 40;
    const sx1 = w - (g.mob ? 16 : 40);
    const sy = h - 70;
    const sh = 34;
    ctx.fillStyle = 'rgba(3,5,14,0.75)';
    ctx.fillRect(sx0 - 6, sy - sh - 12, sx1 - sx0 + 12, 2 * sh + 20);
    const maxPhi = B0 * Math.PI * a * a || 1;
    const maxEmf = B0 * om * Math.PI * a * a || 1;
    const plot = (key: 'phi' | 'emf', mx: number, colr: string) => {
      ctx.beginPath();
      hist.forEach((p, i) => {
        const x = sx0 + ((p.t - (t - 4)) / 4) * (sx1 - sx0);
        const y = sy - (p[key] / mx) * sh * 0.9;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = colr;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    };
    plot('phi', maxPhi, YEL);
    plot('emf', maxEmf, RED);
    text(ctx, 'magnetic flux Φ through the loop', sx0, sy - sh - 1, { size: 10.5, color: YEL, font: FONT_MONO });
    text(ctx, 'EMF = −dΦ/dt', sx0 + 260, sy - sh - 1, { size: 10.5, color: RED, font: FONT_MONO });
    void w;
  }

  function drawWave(ctx: CanvasRenderingContext2D, w: number, h: number, g: G) {
    const y = yee.current;
    if (running) {
      for (let s = 0; s < 2; s++) {
        const src = Math.sin((2 * Math.PI * y.time) / lambdaCells) * 0.06;
        y.step(src, 30);
      }
    }
    const x0 = g.mob ? 16 : 50;
    const x1 = w - (g.mob ? 16 : 50);
    const cy = g.cy + 10;
    const A = Math.min(110, (h - g.top) * 0.28);
    const X = (i: number) => x0 + (i / (y.n - 1)) * (x1 - x0);
    // slab
    ctx.fillStyle = 'rgba(122,180,255,0.07)';
    ctx.fillRect(X(230), g.top + 10, X(330) - X(230), h - g.top - 70);
    text(ctx, `medium: εᵣ = ${fix(epsR, 2)}, μᵣ = ${fix(muR, 2)}`, (X(230) + X(330)) / 2, g.top + 26, { align: 'center', size: 11, color: 'rgba(170,200,255,0.8)', font: FONT_MONO });
    // axis
    ctx.strokeStyle = 'rgba(200,210,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    ctx.stroke();
    let emax = 1e-6;
    for (let i = 0; i < y.n; i++) emax = Math.max(emax, Math.abs(y.E[i]), Math.abs(y.B[i]));
    const k = Math.max(emax, 0.25);
    // B (depth axis, drawn obliquely)
    const ox = 0.55;
    const oy = 0.38;
    ctx.strokeStyle = 'rgba(74,168,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < y.n; i += 6) {
      const b = (y.B[i] / k) * A;
      ctx.beginPath();
      ctx.moveTo(X(i), cy);
      ctx.lineTo(X(i) - b * ox, cy + b * oy);
      ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle = BLUE;
    ctx.shadowColor = BLUE;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < y.n; i++) {
      const b = (y.B[i] / k) * A;
      if (i) ctx.lineTo(X(i) - b * ox, cy + b * oy);
      else ctx.moveTo(X(i) - b * ox, cy + b * oy);
    }
    ctx.stroke();
    ctx.restore();
    // E (vertical)
    ctx.strokeStyle = 'rgba(255,207,74,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < y.n; i += 6) {
      ctx.beginPath();
      ctx.moveTo(X(i), cy);
      ctx.lineTo(X(i), cy - (y.E[i] / k) * A);
      ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle = YEL;
    ctx.shadowColor = YEL;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < y.n; i++) (i ? ctx.lineTo(X(i), cy - (y.E[i] / k) * A) : ctx.moveTo(X(i), cy - (y.E[i] / k) * A));
    ctx.stroke();
    ctx.restore();
    dot(ctx, X(30), cy, 5, '#fff', 12);
    text(ctx, 'oscillating current (source)', X(30), cy + A + 26, { align: 'center', size: 10.5, color: 'rgba(230,235,255,0.7)', font: FONT_MONO });
    text(ctx, 'E', x1 - 8, cy - A - 4, { color: YEL, font: FONT_SERIF, italic: true, size: 18 });
    text(ctx, 'B', x1 - 30, cy + A * 0.5, { color: BLUE, font: FONT_SERIF, italic: true, size: 18 });
    if (!displacement) text(ctx, 'Without ∂E/∂t in Ampère’s law, nothing propagates: the fields stay pinned to the source.', w / 2, h - 66, { align: 'center', size: 13, color: '#ffd28a', font: FONT_SERIF, italic: true });
  }

  usePointer(canvasRef, {
    down: (p) => {
      const el = canvasRef.current!;
      const g = geom(el.clientWidth, el.clientHeight);
      if (scene !== 'gauss' && scene !== 'magnet') return false;
      const near = (x: number, y: number, r = 22) => Math.hypot(p.x - g.X(x), p.y - g.Y(y)) < r;
      if (near(loop.x + loop.r, loop.y)) drag.current = { kind: 'radius' };
      else if (near(loop.x, loop.y)) drag.current = { kind: 'loop' };
      else {
        const list = scene === 'gauss' ? charges : wires;
        const i = list.findIndex((c) => near(c.x, c.y, 26));
        if (i < 0) return false;
        drag.current = { kind: scene === 'gauss' ? 'charge' : 'wire', i };
      }
    },
    move: (p, dragging) => {
      if (!dragging || !drag.current) return;
      const el = canvasRef.current!;
      const g = geom(el.clientWidth, el.clientHeight);
      const [x, y] = g.inv(p.x, p.y);
      const cx = clamp(x, -1.9, 1.9);
      const cy = clamp(y, -1.3, 1.3);
      const d = drag.current;
      if (d.kind === 'loop') {
        setLoop((l) => ({ ...l, x: cx, y: cy }));
        setLoopMoved((m) => ({ ...m, [scene]: true }));
      } else if (d.kind === 'radius') {
        setLoop((l) => ({ ...l, r: clamp(Math.hypot(x - l.x, y - l.y), 0.1, 1.6) }));
        setLoopMoved((m) => ({ ...m, [scene]: true }));
      } else if (d.kind === 'charge') setCharges((cs) => cs.map((c, k) => (k === d.i ? { ...c, x: cx, y: cy } : c)));
      else setWires((ws) => ws.map((wr, k) => (k === d.i ? { ...wr, x: cx, y: cy } : wr)));
    },
    up: () => (drag.current = null),
  });

  // live integrals
  const fluxE = circleFlux((x, y) => eField(charges, x, y), loop.x, loop.y, loop.r, 1440);
  const qEnc = charges.filter((c) => Math.hypot(c.x - loop.x, c.y - loop.y) < loop.r).reduce((s, c) => s + c.q, 0);
  const expectE = (qEnc * 1e-9) / EPS0;
  const circB = circleCirculation((x, y) => bField(wires, x, y), loop.x, loop.y, loop.r, 1440);
  const fluxB = circleFlux((x, y) => bField(wires, x, y), loop.x, loop.y, loop.r, 1440);
  const iEnc = wires.filter((wr) => Math.hypot(wr.x - loop.x, wr.y - loop.y) < loop.r).reduce((s, wr) => s + wr.I, 0);
  const cVac = 1 / Math.sqrt(MU0 * EPS0);
  const ex = EXAMPLES[example];

  const reset = () => {
    setCharges([
      { x: -0.45, y: 0, q: 2 },
      { x: 0.45, y: 0, q: -2 },
      { x: 0.2, y: 0.75, q: 1 },
    ]);
    setWires([
      { x: -0.35, y: 0, I: 5 },
      { x: 0.5, y: 0.2, I: -3 },
    ]);
    setLoop({ x: -0.3, y: 0, r: 0.55 });
    setB0(0.8);
    setFF(0.5);
    setRloop(0.55);
    setLambdaCells(60);
    setEpsR(2.25);
    setMuR(1);
    setDisplacement(true);
    yee.current.reset();
    faraday.current.hist = [];
    setRunning(!reduced);
  };

  const sceneControls =
    scene === 'gauss' ? (
      <ControlGroup title="Charges (line charges ⟂ screen)">
        <div className="btn-row">
          <Btn onClick={() => setCharges((c) => [...c, { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.5) * 1.2, q: 1 }])}>+ Positive</Btn>
          <Btn onClick={() => setCharges((c) => [...c, { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.5) * 1.2, q: -1 }])}>+ Negative</Btn>
          <Btn onClick={() => setCharges((c) => c.slice(0, -1))} disabled={charges.length <= 1}>
            Remove last
          </Btn>
        </div>
        <div className="btn-row">
          <Btn onClick={() => setCharges([{ x: -0.4, y: 0, q: 2 }, { x: 0.4, y: 0, q: -2 }])}>Dipole</Btn>
          <Btn onClick={() => setCharges([{ x: -0.4, y: 0, q: 2 }, { x: 0.4, y: 0, q: 2 }])}>Like charges</Btn>
          <Btn onClick={() => setCharges([{ x: -0.4, y: -0.4, q: 1.5 }, { x: 0.4, y: 0.4, q: 1.5 }, { x: -0.4, y: 0.4, q: -1.5 }, { x: 0.4, y: -0.4, q: -1.5 }])}>Quadrupole</Btn>
        </div>
        <Toggle label="Equipotential lines" checked={showEquip} onChange={setShowEquip} />
        <p className="responds" style={{ margin: 0 }}>Drag charges and the green Gaussian loop (centre and rim handles).</p>
      </ControlGroup>
    ) : scene === 'magnet' ? (
      <ControlGroup title="Wires (currents ⟂ screen)">
        <div className="btn-row">
          <Btn onClick={() => setWires((ws) => [...ws, { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.5) * 1.2, I: 4 }])}>+ Current out</Btn>
          <Btn onClick={() => setWires((ws) => [...ws, { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.5) * 1.2, I: -4 }])}>+ Current in</Btn>
          <Btn onClick={() => setWires((ws) => ws.slice(0, -1))} disabled={wires.length <= 1}>
            Remove last
          </Btn>
        </div>
        <p className="responds" style={{ margin: 0 }}>Magnetic field lines always close on themselves — there are no magnetic “charges” for them to start or end on.</p>
      </ControlGroup>
    ) : scene === 'faraday' ? (
      <ControlGroup title="Changing magnetic field">
        <Slider label="Peak field" tex="B_0" value={B0} min={0.05} max={2} step={0.01} onChange={setB0} format={(v) => fix(v, 2)} unit="T" />
        <Slider label="Frequency" tex="f" value={fF} min={0.1} max={2} step={0.01} onChange={setFF} format={(v) => fix(v, 2)} unit="Hz" />
        <Slider label="Loop radius" tex="R" value={Rloop} min={0.1} max={1.3} step={0.01} onChange={setRloop} format={(v) => fix(v, 2)} unit="m" tip="Outside the solenoid (radius 0.35 m) the flux stops growing — yet the induced E field still circulates there." />
      </ControlGroup>
    ) : (
      <ControlGroup title="Electromagnetic wave">
        <Toggle label="Maxwell’s displacement current μ₀ε₀ ∂E/∂t" checked={displacement} onChange={(v) => { setDisplacement(v); yee.current.reset(); }} />
        <Slider label="Wavelength" value={lambdaCells} min={20} max={140} step={1} onChange={setLambdaCells} format={(v) => `${Math.round(v)} cells`} />
        <Slider label="Relative permittivity" tex="\varepsilon_r" value={epsR} min={1} max={6} step={0.01} onChange={setEpsR} format={(v) => fix(v, 2)} />
        <Slider label="Relative permeability" tex="\mu_r" value={muR} min={1} max={4} step={0.01} onChange={setMuR} format={(v) => fix(v, 2)} />
        <Segmented small label="Real-world wave" value={String(example)} onChange={(v) => setExample(Number(v))} options={EXAMPLES.map((e, i) => ({ value: String(i), label: e.label }))} />
      </ControlGroup>
    );

  const readouts =
    scene === 'gauss' ? (
      <Readouts
        items={[
          { label: '∮ E·n dl (numerical)', value: `${fmt(fluxE, 4)} V`, accent: true },
          { label: 'λ_enc / ε₀', value: `${fmt(expectE, 4)} V`, accent: true },
          { label: 'enclosed charge', value: `${fix(qEnc, 2)} nC/m` },
          { label: 'agreement', value: Math.abs(expectE) > 1e-6 ? `${fix((fluxE / expectE) * 100, 3)}%` : Math.abs(fluxE) < 1 ? 'both ≈ 0' : '—' },
        ]}
      />
    ) : scene === 'magnet' ? (
      <Readouts
        items={[
          { label: '∮ B·dl (numerical)', value: `${sci(circB, 4)} T·m`, accent: true },
          { label: 'μ₀ I_enc (Ampère)', value: `${sci(MU0 * iEnc, 4)} T·m`, accent: true },
          { label: '∮ B·n dl (Gauss for B)', value: `${sci(Math.abs(fluxB) < 1e-13 ? 0 : fluxB, 2)} T·m` },
          { label: 'enclosed current', value: `${fix(iEnc, 1)} A` },
        ]}
      />
    ) : scene === 'faraday' ? (
      <Readouts
        items={[
          { label: 'flux amplitude', value: `${fix(B0 * Math.PI * Math.min(Rloop, 0.35) ** 2, 4)} Wb` },
          { label: 'EMF amplitude ω·Φ₀', value: `${fix(2 * Math.PI * fF * B0 * Math.PI * Math.min(Rloop, 0.35) ** 2, 4)} V`, accent: true },
          { label: 'E at loop (peak)', value: `${fix(Math.abs(inducedE(Rloop, 0.35, B0 * 2 * Math.PI * fF)), 4)} V/m` },
          { label: '∮E·dl = −dΦ/dt', value: 'exact for this geometry' },
        ]}
      />
    ) : (
      <Readouts
        items={[
          { label: '1/√(μ₀ε₀)', value: `${fmt(cVac, 9)} m/s`, accent: true },
          { label: 'speed of light c (exact)', value: `${C_LIGHT.toLocaleString('en-US')} m/s` },
          { label: 'speed in medium c/√(εᵣμᵣ)', value: `${fmt(C_LIGHT / Math.sqrt(epsR * muR), 4)} m/s` },
          { label: 'refractive index n', value: fix(Math.sqrt(epsR * muR), 3) },
          { label: `${ex.label}: f`, value: `${sci(ex.f, 3)} Hz` },
          { label: 'wavelength λ = c/f', value: lengthLabel(C_LIGHT / ex.f) },
        ]}
      />
    );

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Electric and magnetic field visualisation" />}
      onReset={reset}
      toolbar={
        scene === 'faraday' || scene === 'wave' ? (
          <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Run'}
          </Btn>
        ) : null
      }
      legend={
        scene === 'wave' ? (
          <>
            <span className="legend-item"><i className="legend-swatch" style={{ background: YEL }} /> electric field E (vertical)</span>
            <span className="legend-item"><i className="legend-swatch" style={{ background: BLUE }} /> magnetic field B (into depth)</span>
          </>
        ) : scene === 'faraday' ? (
          <>
            <span className="legend-item"><i className="legend-swatch" style={{ background: YEL }} /> B out of screen</span>
            <span className="legend-item"><i className="legend-swatch" style={{ background: BLUE }} /> B into screen</span>
            <span className="legend-item"><i className="legend-swatch" style={{ background: RED }} /> induced E</span>
          </>
        ) : undefined
      }
      notice={
        scene === 'gauss' && Math.abs(qEnc) < 1e-9 && charges.some((c) => Math.hypot(c.x - loop.x, c.y - loop.y) < loop.r + 0.6) ? (
          <Callout tone="event">No net charge inside: field lines that enter the loop also leave it, so the net flux is zero.</Callout>
        ) : scene === 'magnet' ? (
          <Callout tone="info">∮B·n dl stays at zero wherever you put the loop: <strong>∇·B = 0</strong>.</Callout>
        ) : scene === 'wave' && displacement ? (
          <Callout tone="event">E and B are perpendicular to each other and to the direction of travel, in step, moving at 1/√(μ₀ε₀) = c.</Callout>
        ) : undefined
      }
      controls={
        <>
          <div className="eq-chips" role="radiogroup" aria-label="Maxwell equation">
            {CHIPS.map((c) => (
              <button
                key={c.scene}
                type="button"
                role="radio"
                aria-checked={scene === c.scene}
                className={`eq-chip ${scene === c.scene ? 'on' : ''}`}
                onClick={() => {
                  setScene(c.scene);
                  cache.current = null;
                }}
              >
                {c.name}
                <Tex tex={c.tex} />
              </button>
            ))}
          </div>
          {sceneControls}
        </>
      }
      readouts={readouts}
    />
  );
}

function lengthLabel(m: number) {
  if (m >= 1) return `${fix(m, 2)} m`;
  if (m >= 1e-2) return `${fix(m * 100, 1)} cm`;
  if (m >= 1e-6) return `${fix(m * 1e6, 1)} µm`;
  if (m >= 1e-9) return `${fix(m * 1e9, 0)} nm`;
  return `${sci(m, 2)} m`;
}
