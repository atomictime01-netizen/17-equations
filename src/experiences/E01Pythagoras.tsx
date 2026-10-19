import { useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { dot, FONT_MONO, FONT_SERIF, handle, text } from '../core/draw';
import { clamp, easeInOutCubic, fix, smoothstep } from '../math/rng';

type View = 'squares' | 'flow' | 'shear' | 'rearrange' | 'coords';
type V2 = [number, number];

const GOLD = '#ffc861';
const CYAN = '#5ee7ff';
const PINK = '#ff7ab6';

/** Local frame: right angle R at origin, B = (b, 0), A = (0, a), y up. */
function geometry(a: number, b: number) {
  const c = Math.hypot(a, b);
  const n: V2 = [a / c, b / c]; // outward normal of the hypotenuse
  const u: V2 = [b / c, -a / c]; // unit vector A → B
  const R: V2 = [0, 0];
  const A: V2 = [0, a];
  const B: V2 = [b, 0];
  const sqA: V2[] = [R, A, [-a, a], [-a, 0]];
  const sqB: V2[] = [R, B, [b, -b], [0, -b]];
  const sqC: V2[] = [B, A, [a, a + b], [a + b, b]];
  const H: V2 = [(a * b * n[0]) / c, (a * b * n[1]) / c]; // foot of the altitude
  return { a, b, c, n, u, R, A, B, H, sqA, sqB, sqC };
}

const add = (p: V2, q: V2): V2 => [p[0] + q[0], p[1] + q[1]];
const scale = (p: V2, k: number): V2 => [p[0] * k, p[1] * k];
const lerp2 = (p: V2, q: V2, t: number): V2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** Euclid I.47 as area-preserving maps: square → (shear) parallelogram → (shear) rectangle → (translate) into c². */
function shearKeyframes(g: ReturnType<typeof geometry>) {
  const { a, b, c, n, u, A, B } = g;
  const cn = scale(n, c);
  const shift = scale(n, (a * b) / c + c);
  const Ap = scale(u, (-a * a) / c);
  const Bp = scale(u, (b * b) / c);
  const KA: V2[][] = [
    g.sqA,
    [[0, 0], A, add(A, scale(cn, -1)), scale(cn, -1)],
    [[0, 0], Ap, add(Ap, scale(cn, -1)), scale(cn, -1)],
  ];
  KA.push(KA[2].map((p) => add(p, shift)));
  const KB: V2[][] = [
    g.sqB,
    [[0, 0], B, add(B, scale(cn, -1)), scale(cn, -1)],
    [[0, 0], Bp, add(Bp, scale(cn, -1)), scale(cn, -1)],
  ];
  KB.push(KB[2].map((p) => add(p, shift)));
  return { KA, KB };
}

function shearAt(K: V2[][], t: number): V2[] {
  // t in [0, 3]: piecewise-linear interpolation is exactly a shear / translation path
  const seg = Math.min(2, Math.floor(t));
  const f = easeInOutCubic(t - seg);
  return K[seg].map((p, i) => lerp2(p, K[seg + 1][i], f));
}

/** Rearrangement proof: four rigid copies of the triangle inside a square of side a+b. */
function rearrangement(a: number, b: number, t: number) {
  const S = a + b;
  const place = [
    { rot: 0, p0: [0, 0] as V2, p1: [a, 0] as V2 },
    { rot: Math.PI / 2, p0: [S, 0] as V2, p1: [a, a] as V2 },
    { rot: Math.PI, p0: [S, S] as V2, p1: [S, a] as V2 },
    { rot: (3 * Math.PI) / 2, p0: [0, S] as V2, p1: [0, S] as V2 },
  ];
  const canon: V2[] = [[0, 0], [b, 0], [0, a]];
  return place.map((pl, k) => {
    const local = smoothstep((t - k * 0.12) / 0.64);
    const p = lerp2(pl.p0, pl.p1, easeInOutCubic(local));
    const lift = Math.sin(local * Math.PI) * 0.12 * S;
    const cs = Math.cos(pl.rot);
    const sn = Math.sin(pl.rot);
    return canon.map(([x, y]) => [p[0] + x * cs - y * sn - lift * 0.3, p[1] + x * sn + y * cs + lift] as V2);
  });
}

export default function Pythagoras() {
  const reduced = useReducedMotion();
  const [a, setA] = useState(2.6);
  const [b, setB] = useState(4.2);
  const [theta, setTheta] = useState(0);
  const [view, setView] = useState<View>('squares');
  const [playing, setPlaying] = useState(!reduced);
  const [P, setP] = useState<V2>([1, 1]);
  const [Q, setQ] = useState<V2>([7, 9]);
  const [dz, setDz] = useState(0);
  const anim = useRef({ t: 0, flowDone: false });
  const cam = useRef({ s: 30, cx: 0, cy: 0, init: false });
  const drag = useRef<null | 'A' | 'B' | 'R' | 'P' | 'Q'>(null);
  const pan = useRef<V2>([0, 0]);
  const hoverRef = useRef<string | null>(null);
  const [flowSeen, setFlowSeen] = useState(false);

  const c = Math.hypot(a, b);
  const g = useMemo(() => geometry(a, b), [a, b]);
  const keys = useMemo(() => shearKeyframes(g), [g]);

  // flow tiles
  const tiles = useMemo(() => {
    const M = 16;
    const total = M * M;
    const nA = Math.round((total * a * a) / (c * c));
    const nB = total - nA;
    const cells: { u: number; v: number }[] = [];
    for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) cells.push({ u: 1 - (i + 0.5) / M, v: (j + 0.5) / M });
    const kA = Math.ceil(Math.sqrt(nA));
    const kB = Math.ceil(Math.sqrt(nB));
    const list: { from: V2; fromSize: number; to: V2; toSize: number; src: 'a' | 'b'; order: number }[] = [];
    cells.forEach((cell, idx) => {
      const isA = idx < nA;
      const k = isA ? idx : idx - nA;
      const kk = isA ? kA : kB;
      const s = isA ? a / kk : b / kk;
      const col = k % kk;
      const row = Math.floor(k / kk);
      const from: V2 = isA ? [-(col + 0.5) * s, (row + 0.5) * s] : [(col + 0.5) * s, -(row + 0.5) * s];
      // target point in the c-square: B + u(A − B) + v c n
      const to: V2 = [b - b * cell.u + cell.v * a, a * cell.u + cell.v * b];
      list.push({ from, fromSize: s, to, toSize: c / M, src: isA ? 'a' : 'b', order: idx / total });
    });
    return { list, nA, nB, total };
  }, [a, b, c]);

  const isTriple = Number.isInteger(a) && Number.isInteger(b) && Math.abs(c - Math.round(c)) < 1e-9;
  useGoalWhen('p-345', Math.abs(a - 3) < 1e-6 && Math.abs(b - 4) < 1e-6);
  useGoalWhen('p-345', Math.abs(a - 4) < 1e-6 && Math.abs(b - 3) < 1e-6);
  useGoalWhen('p-triple', isTriple && !(Math.min(a, b) === 3 && Math.max(a, b) === 4));
  useGoalWhen('p-iso', Math.abs(a - b) < 1e-6);
  useGoalWhen('p-flow', flowSeen);

  const proofT = useThrottledValue(() => anim.current.t, 100, view !== 'squares');

  const toScreen = (p: V2): V2 => {
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    const x = p[0] * cs - p[1] * sn + pan.current[0];
    const y = p[0] * sn + p[1] * cs + pan.current[1];
    return [cam.current.cx + x * cam.current.s, cam.current.cy - y * cam.current.s];
  };

  // coordinate-mode mapping
  const coordMap = (w: number, h: number) => {
    const top = w < 700 ? 120 : 150;
    const pad = 40;
    const s = Math.min((w - pad * 2) / 12, (h - top - pad - 50) / 11);
    const ox = (w - 12 * s) / 2 + s;
    const oy = top + 10 * s + 10;
    return { s, X: (x: number) => ox + x * s, Y: (y: number) => oy - y * s, inv: (px: number, py: number): V2 => [(px - ox) / s, (oy - py) / s] };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const mob = w < 700;
      if (view === 'coords') {
        drawCoords(ctx, w, h);
        return;
      }
      if (playing && view !== 'squares') {
        const speed = view === 'flow' ? 1 / 6 : view === 'shear' ? 1 / 7 : 1 / 5.5;
        anim.current.t = (anim.current.t + dt * speed) % 1;
      }
      // fit the figure
      const pts: V2[] = view === 'rearrange' ? [[0, 0], [a + b, a + b], [-(a + b) * 0.15, 0], [(a + b) * 1.15, 0]] : [...g.sqA, ...g.sqB, ...g.sqC];
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const p of pts) {
        const x = view === 'rearrange' ? p[0] : p[0] * cs - p[1] * sn;
        const y = view === 'rearrange' ? p[1] : p[0] * sn + p[1] * cs;
        minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      }
      const top = mob ? 120 : 150;
      const availW = w - 60;
      const availH = h - top - 70;
      const ts = Math.min(availW / (maxx - minx), availH / (maxy - miny));
      const tcx = w / 2 - ((minx + maxx) / 2) * ts;
      const tcy = top + availH / 2 + ((miny + maxy) / 2) * ts;
      const k = cam.current.init && drag.current ? 0 : cam.current.init ? 0.12 : 1;
      cam.current.s += (ts - cam.current.s) * k;
      cam.current.cx += (tcx - cam.current.cx) * k;
      cam.current.cy += (tcy - cam.current.cy) * k;
      cam.current.init = true;

      if (view === 'rearrange') {
        drawRearrange(ctx, w, h);
        return;
      }
      const S = toScreen;
      const poly = (vs: V2[]) => {
        ctx.beginPath();
        vs.forEach((p, i) => {
          const [x, y] = S(p);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
      };
      const fillSquare = (vs: V2[], col: string, alpha: number) => {
        poly(vs);
        const [x0, y0] = S(vs[0]);
        const [x2, y2] = S(vs[2]);
        const gr = ctx.createLinearGradient(x0, y0, x2, y2);
        gr.addColorStop(0, hexA(col, alpha * 0.55));
        gr.addColorStop(1, hexA(col, alpha * 0.18));
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = hexA(col, 0.95);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      };
      const unitGrid = (vs: V2[], side: number, col: string) => {
        if (side > 14 || cam.current.s < 9) return;
        ctx.save();
        poly(vs);
        ctx.clip();
        ctx.strokeStyle = hexA(col, 0.22);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const e1: V2 = [(vs[1][0] - vs[0][0]) / side, (vs[1][1] - vs[0][1]) / side];
        const e2: V2 = [(vs[3][0] - vs[0][0]) / side, (vs[3][1] - vs[0][1]) / side];
        for (let i = 1; i < side; i++) {
          const p1 = S(add(vs[0], scale(e1, i)));
          const p2 = S(add(vs[3], scale(e1, i)));
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          const q1 = S(add(vs[0], scale(e2, i)));
          const q2 = S(add(vs[1], scale(e2, i)));
          ctx.moveTo(q1[0], q1[1]);
          ctx.lineTo(q2[0], q2[1]);
        }
        ctx.stroke();
        ctx.restore();
      };

      if (view === 'squares') {
        fillSquare(g.sqA, GOLD, 1);
        fillSquare(g.sqB, CYAN, 1);
        fillSquare(g.sqC, PINK, 1);
        unitGrid(g.sqA, a, GOLD);
        unitGrid(g.sqB, b, CYAN);
        unitGrid(g.sqC, c, PINK);
      } else if (view === 'flow') {
        // ghost outlines
        for (const [sq, col] of [[g.sqA, GOLD], [g.sqB, CYAN], [g.sqC, PINK]] as [V2[], string][]) {
          poly(sq);
          ctx.strokeStyle = hexA(col, 0.4);
          ctx.setLineDash([4, 5]);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const T = anim.current.t * 6; // seconds within the 6-second cycle
        const angC = Math.atan2(g.A[1] - g.B[1], g.A[0] - g.B[0]);
        for (const tile of tiles.list) {
          let f: number;
          if (T < 0.8) f = 0;
          else if (T < 3.6) f = smoothstep((T - 0.8 - tile.order * 1.6) / 1.2);
          else if (T < 5.2) f = 1;
          else f = 1 - smoothstep((T - 5.2) / 0.7);
          if (T > 3.6 && T < 5.2 && !anim.current.flowDone) {
            anim.current.flowDone = true;
            setFlowSeen(true);
          }
          const mid = lerp2(tile.from, tile.to, 0.5);
          const lift = scale(g.n, Math.sin(f * Math.PI) * c * 0.35);
          const ctrl = add(mid, lift);
          const p = lerp2(lerp2(tile.from, ctrl, f), lerp2(ctrl, tile.to, f), f);
          const size = tile.fromSize + (tile.toSize - tile.fromSize) * f;
          const ang0 = 0;
          const ang = ang0 + (angC - Math.PI - ang0) * f + theta;
          const [sx, sy] = S(p);
          const px = size * cam.current.s * 0.88;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(-ang);
          const col = tile.src === 'a' ? GOLD : CYAN;
          ctx.fillStyle = hexA(col, 0.78);
          ctx.shadowColor = col;
          ctx.shadowBlur = f > 0 && f < 1 ? 10 : 4;
          ctx.fillRect(-px / 2, -px / 2, px, px);
          ctx.restore();
        }
      } else if (view === 'shear') {
        const t3 = clamp(anim.current.t * 1.25, 0, 1) * 3;
        // destination ghost
        poly(g.sqC);
        ctx.fillStyle = hexA(PINK, 0.08);
        ctx.fill();
        ctx.strokeStyle = hexA(PINK, 0.8);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // altitude line through c²
        const H = g.H;
        const Hfar = add(H, scale(g.n, c));
        const [h1x, h1y] = S([0, 0]);
        const [h2x, h2y] = S(Hfar);
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(h1x, h1y);
        ctx.lineTo(h2x, h2y);
        ctx.stroke();
        ctx.setLineDash([]);
        poly(g.sqA);
        ctx.strokeStyle = hexA(GOLD, 0.3);
        ctx.stroke();
        poly(g.sqB);
        ctx.strokeStyle = hexA(CYAN, 0.3);
        ctx.stroke();
        fillSquare(shearAt(keys.KA, t3), GOLD, 1);
        fillSquare(shearAt(keys.KB, t3), CYAN, 1);
        const stageLabel = t3 < 1 ? 'Shear 1 — slide parallel to a leg (base and height unchanged)' : t3 < 2 ? 'Shear 2 — slide parallel to the altitude' : t3 < 2.999 ? 'Translate — move without distortion' : 'The two rectangles tile c² exactly';
        text(ctx, stageLabel, w / 2, h - 58, { align: 'center', size: mob ? 12 : 14, color: 'rgba(232,237,251,0.85)', font: FONT_SERIF, italic: true, shadow: true });
      }

      // triangle
      poly([g.R, g.B, g.A]);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#9fdfff';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
      // right-angle marker
      const m = Math.min(a, b) * 0.18;
      poly([[0, 0], [m, 0], [m, m], [0, m]]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // labels
      const lab = (p: V2, s: string, col: string, size = 18) => {
        const [x, y] = S(p);
        text(ctx, s, x, y, { align: 'center', baseline: 'middle', color: col, size, font: FONT_SERIF, italic: true, shadow: true });
      };
      if (view === 'squares' || view === 'flow') {
        lab([-a / 2, a / 2], `a² = ${fix(a * a, 2)}`, GOLD, mob ? 15 : 19);
        lab([b / 2, -b / 2], `b² = ${fix(b * b, 2)}`, CYAN, mob ? 15 : 19);
        lab([(a + b) / 2, (a + b) / 2], `c² = ${fix(c * c, 2)}`, PINK, mob ? 16 : 21);
      }
      const inset = Math.min(a, b) * 0.14;
      lab([inset, a * 0.42], 'a', '#fff', 17);
      lab([b * 0.42, inset], 'b', '#fff', 17);
      lab(add(lerp2(g.A, g.B, 0.5), scale(g.n, -inset * 1.2)), 'c', '#fff', 17);

      // handles
      const hv = hoverRef.current;
      if (view === 'squares' || view === 'flow') {
        const [ax, ay] = S(g.A);
        const [bx, by] = S(g.B);
        const [rx, ry] = S(g.R);
        handle(ctx, ax, ay, GOLD, drag.current === 'A' || hv === 'A');
        handle(ctx, bx, by, CYAN, drag.current === 'B' || hv === 'B');
        dot(ctx, rx, ry, drag.current === 'R' || hv === 'R' ? 6 : 4, 'rgba(255,255,255,0.8)', 8);
      }
    },
    { animate: true },
  );

  function drawRearrange(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const S0 = a + b;
    const s = cam.current.s;
    const ox = cam.current.cx;
    const oy = cam.current.cy;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy - y * s;
    const t = anim.current.t;
    const phase = t < 0.4 ? 0 : t < 0.5 ? smoothstep((t - 0.4) / 0.1) : t < 0.9 ? 1 : 1 - smoothstep((t - 0.9) / 0.1);
    const tris = rearrangement(a, b, phase);
    // outer square
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(0), Y(S0), S0 * s, S0 * s);
    // holes
    if (phase < 0.05) {
      ctx.beginPath();
      ([[b, 0], [S0, b], [a, S0], [0, a]] as V2[]).forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.closePath();
      ctx.fillStyle = hexA(PINK, 0.35);
      ctx.fill();
      text(ctx, `c² = ${fix(c * c, 2)}`, X(S0 / 2), Y(S0 / 2), { align: 'center', baseline: 'middle', color: PINK, size: 20, font: FONT_SERIF, italic: true, shadow: true });
    } else if (phase > 0.95) {
      ctx.fillStyle = hexA(GOLD, 0.4);
      ctx.fillRect(X(0), Y(a), a * s, a * s);
      ctx.fillStyle = hexA(CYAN, 0.4);
      ctx.fillRect(X(a), Y(S0), b * s, b * s);
      text(ctx, `a² = ${fix(a * a, 2)}`, X(a / 2), Y(a / 2), { align: 'center', baseline: 'middle', color: GOLD, size: 18, font: FONT_SERIF, italic: true, shadow: true });
      text(ctx, `b² = ${fix(b * b, 2)}`, X(a + b / 2), Y(a + b / 2), { align: 'center', baseline: 'middle', color: CYAN, size: 18, font: FONT_SERIF, italic: true, shadow: true });
    }
    const cols = ['#ffffff', '#d8e7ff', '#e9dcff', '#ffe3f2'];
    tris.forEach((tri, k) => {
      ctx.beginPath();
      tri.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,40,80,0.85)';
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = cols[k];
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#9fdfff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    });
    const msg = phase < 0.05 ? 'Four triangles leave a tilted square hole of area c²' : phase > 0.95 ? 'Same four triangles, same big square — holes a² + b²' : 'Rearranging (rigid moves: no area changes)';
    text(ctx, msg, w / 2, h - 58, { align: 'center', size: w < 700 ? 12 : 14, color: 'rgba(232,237,251,0.85)', font: FONT_SERIF, italic: true, shadow: true });
  }

  function drawCoords(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const m = coordMap(w, h);
    // grid
    ctx.lineWidth = 1;
    for (let i = -1; i <= 11; i++) {
      ctx.strokeStyle = i === 0 ? 'rgba(180,195,255,0.35)' : 'rgba(140,160,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(m.X(i), m.Y(-1));
      ctx.lineTo(m.X(i), m.Y(10));
      ctx.stroke();
    }
    for (let j = -1; j <= 10; j++) {
      ctx.strokeStyle = j === 0 ? 'rgba(180,195,255,0.35)' : 'rgba(140,160,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(m.X(-1), m.Y(j));
      ctx.lineTo(m.X(11), m.Y(j));
      ctx.stroke();
      if (j >= 0) text(ctx, String(j), m.X(-1) - 6, m.Y(j) + 3, { size: 10, align: 'right', color: 'rgba(150,165,205,0.6)', font: FONT_MONO });
    }
    for (let i = 0; i <= 11; i++) text(ctx, String(i), m.X(i), m.Y(-1) + 14, { size: 10, align: 'center', color: 'rgba(150,165,205,0.6)', font: FONT_MONO });
    const [px, py] = [m.X(P[0]), m.Y(P[1])];
    const [qx, qy] = [m.X(Q[0]), m.Y(Q[1])];
    // legs
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CYAN;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(qx, py);
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.shadowColor = GOLD;
    ctx.beginPath();
    ctx.moveTo(qx, py);
    ctx.lineTo(qx, qy);
    ctx.stroke();
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(qx, qy);
    ctx.stroke();
    ctx.restore();
    const dx = Q[0] - P[0];
    const dy = Q[1] - P[1];
    text(ctx, `Δx = ${fix(dx, 1)}`, (px + qx) / 2, py + (dy >= 0 ? 18 : -10), { align: 'center', color: CYAN, size: 13, font: FONT_MONO, shadow: true });
    text(ctx, `Δy = ${fix(dy, 1)}`, qx + (dx >= 0 ? 10 : -10), (py + qy) / 2, { align: dx >= 0 ? 'left' : 'right', color: GOLD, size: 13, font: FONT_MONO, shadow: true });
    const d = Math.hypot(dx, dy);
    text(ctx, `d = ${fix(d, 3)}`, (px + qx) / 2 - (dy >= 0 ? 14 : -14), (py + qy) / 2 - 8, { align: 'right', color: PINK, size: 14, font: FONT_MONO, shadow: true });
    handle(ctx, px, py, CYAN, drag.current === 'P' || hoverRef.current === 'P');
    handle(ctx, qx, qy, PINK, drag.current === 'Q' || hoverRef.current === 'Q');
    text(ctx, 'P', px - 14, py + 18, { color: '#fff', font: FONT_SERIF, italic: true, size: 16 });
    text(ctx, 'Q', qx + 12, qy - 10, { color: '#fff', font: FONT_SERIF, italic: true, size: 16 });
    // compass rose for the navigation reading
    const cx0 = w - 60;
    const cy0 = h - 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(cx0, cy0, 22, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, 'N', cx0, cy0 - 28, { align: 'center', size: 11, color: GOLD, font: FONT_MONO });
    text(ctx, 'E', cx0 + 30, cy0 + 4, { align: 'left', size: 11, color: CYAN, font: FONT_MONO });
    const hd = Math.atan2(dx, dy);
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx0, cy0);
    ctx.lineTo(cx0 + 20 * Math.sin(hd), cy0 - 20 * Math.cos(hd));
    ctx.stroke();
  }

  usePointer(canvasRef, {
    down: (p) => {
      const w = canvasRef.current!.clientWidth;
      const h = canvasRef.current!.clientHeight;
      if (view === 'coords') {
        const m = coordMap(w, h);
        const dP = Math.hypot(p.x - m.X(P[0]), p.y - m.Y(P[1]));
        const dQ = Math.hypot(p.x - m.X(Q[0]), p.y - m.Y(Q[1]));
        if (Math.min(dP, dQ) > 30) return false;
        drag.current = dP < dQ ? 'P' : 'Q';
        return;
      }
      if (view !== 'squares' && view !== 'flow') return false;
      const cand: [string, V2][] = [
        ['A', g.A],
        ['B', g.B],
        ['R', g.R],
      ];
      let best: string | null = null;
      let bd = 28;
      for (const [k, pt] of cand) {
        const [sx, sy] = toScreen(pt);
        const d = Math.hypot(sx - p.x, sy - p.y);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (!best) return false;
      drag.current = best as 'A' | 'B' | 'R';
    },
    move: (p, dragging) => {
      const w = canvasRef.current!.clientWidth;
      const h = canvasRef.current!.clientHeight;
      if (!dragging || !drag.current) {
        // hover feedback
        let hv: string | null = null;
        if (view === 'coords') {
          const m = coordMap(w, h);
          if (Math.hypot(p.x - m.X(P[0]), p.y - m.Y(P[1])) < 24) hv = 'P';
          else if (Math.hypot(p.x - m.X(Q[0]), p.y - m.Y(Q[1])) < 24) hv = 'Q';
        } else if (view === 'squares' || view === 'flow') {
          for (const [k, pt] of [['A', g.A], ['B', g.B], ['R', g.R]] as [string, V2][]) {
            const [sx, sy] = toScreen(pt);
            if (Math.hypot(sx - p.x, sy - p.y) < 24) hv = k;
          }
        }
        hoverRef.current = hv;
        canvasRef.current!.style.cursor = hv ? 'grab' : 'default';
        return;
      }
      if (drag.current === 'P' || drag.current === 'Q') {
        const m = coordMap(w, h);
        const [x, y] = m.inv(p.x, p.y);
        const snap: V2 = [clamp(Math.round(x * 2) / 2, 0, 10), clamp(Math.round(y * 2) / 2, 0, 9.5)];
        if (drag.current === 'P') setP(snap);
        else setQ(snap);
        return;
      }
      if (drag.current === 'R') {
        pan.current = [pan.current[0] + p.dx / cam.current.s, pan.current[1] - p.dy / cam.current.s];
        return;
      }
      // vertex drags: length follows the pointer, the whole triangle rotates so the right angle is preserved
      const ox = cam.current.cx + pan.current[0] * cam.current.s;
      const oy = cam.current.cy - pan.current[1] * cam.current.s;
      const vx = (p.x - ox) / cam.current.s;
      const vy = -(p.y - oy) / cam.current.s;
      const len = snapLen(Math.hypot(vx, vy));
      const ang = Math.atan2(vy, vx);
      if (drag.current === 'B') {
        setB(len);
        setTheta(ang);
      } else {
        setA(len);
        setTheta(ang - Math.PI / 2);
      }
    },
    up: () => {
      drag.current = null;
    },
  });

  const reset = () => {
    setA(2.6);
    setB(4.2);
    setTheta(0);
    pan.current = [0, 0];
    setP([1, 1]);
    setQ([7, 9]);
    setDz(0);
    anim.current.t = 0;
    setPlaying(!reduced);
  };

  const dx = Q[0] - P[0];
  const dy = Q[1] - P[1];
  const d2 = Math.hypot(dx, dy);
  const d3 = Math.hypot(dx, dy, dz);

  const toolbar =
    view !== 'squares' && view !== 'coords' ? (
      <Btn onClick={() => setPlaying((p) => !p)} icon={playing ? Icon.pause : Icon.play} title={playing ? 'Pause' : 'Play'}>
        {playing ? 'Pause' : 'Play'}
      </Btn>
    ) : null;

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Right triangle with squares on each side. Drag the coloured corner handles." />}
      toolbar={toolbar}
      onReset={reset}
      legend={
        view !== 'coords' ? (
          <>
            <span className="legend-item"><i className="legend-swatch" style={{ background: GOLD }} /> square on a</span>
            <span className="legend-item"><i className="legend-swatch" style={{ background: CYAN }} /> square on b</span>
            <span className="legend-item"><i className="legend-swatch" style={{ background: PINK }} /> square on c</span>
          </>
        ) : undefined
      }
      notice={
        view !== 'coords' && isTriple ? (
          <Callout tone="success">
            <strong>Pythagorean triple!</strong> {a}² + {b}² = {Math.round(c)}² — every side is a whole number.
          </Callout>
        ) : view !== 'coords' && Math.abs(a - b) < 1e-6 ? (
          <Callout tone="event">
            Isosceles right triangle: c = a√2 ≈ {fix(c, 4)}. √2 is irrational — no whole-number triple has equal legs.
          </Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="View"
            value={view}
            onChange={(v) => {
              setView(v);
              anim.current.t = 0;
              anim.current.flowDone = false;
              cam.current.init = false;
              if (!reduced) setPlaying(true);
            }}
            options={[
              { value: 'squares', label: 'Squares' },
              { value: 'flow', label: 'Area flow' },
              { value: 'shear', label: 'Euclid’s proof' },
              { value: 'rearrange', label: 'Rearrange' },
              { value: 'coords', label: 'Distance' },
            ]}
          />
          {view !== 'coords' ? (
            <ControlGroup title="Triangle">
              <Slider label="Leg a" tex="a" value={a} min={0.5} max={12} step={0.1} onChange={setA} format={(v) => fix(v, 2)} tip="Drag the gold handle on the canvas too." />
              <Slider label="Leg b" tex="b" value={b} min={0.5} max={12} step={0.1} onChange={setB} format={(v) => fix(v, 2)} tip="Drag the cyan handle on the canvas too." />
              {view !== 'rearrange' && (
                <Slider label="Rotation" value={(theta * 180) / Math.PI} min={-180} max={180} step={1} onChange={(v) => setTheta((v * Math.PI) / 180)} format={(v) => fix(v, 0)} unit="°" tip="Rotating the triangle changes nothing about the areas." />
              )}
              {view !== 'squares' && (
                <Slider
                  label="Animation"
                  value={proofT}
                  min={0}
                  max={0.999}
                  onChange={(v) => {
                    anim.current.t = v;
                    setPlaying(false);
                  }}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              )}
              <div className="btn-row">
                {[
                  [3, 4],
                  [5, 12],
                  [8, 15],
                  [7, 24],
                  [1, 1],
                ].map(([x, y]) => (
                  <Btn key={`${x}-${y}`} onClick={() => { setA(x); setB(y); }}>
                    {x}–{y}
                  </Btn>
                ))}
              </div>
            </ControlGroup>
          ) : (
            <ControlGroup title="Two points">
              <p className="responds" style={{ margin: 0 }}>Drag P and Q. Read the grid as kilometres east (x) and north (y) of a harbour.</p>
              <Slider label="Height difference Δz (3-D)" tex="\Delta z" value={dz} min={0} max={10} step={0.5} onChange={setDz} format={(v) => fix(v, 1)} tip="In three dimensions the theorem is simply applied twice." />
            </ControlGroup>
          )}
        </>
      }
      readouts={
        view !== 'coords' ? (
          <Readouts
            items={[
              { label: 'a²', value: fix(a * a, 2) },
              { label: 'b²', value: fix(b * b, 2) },
              { label: 'a² + b²', value: fix(a * a + b * b, 2), accent: true },
              { label: 'c²', value: fix(c * c, 2), accent: true },
              { label: 'hypotenuse c', value: fix(c, 4) },
              { label: 'area flow tiles', value: view === 'flow' ? `${tiles.nA} + ${tiles.nB} = ${tiles.total}` : '—', hint: 'Each tile carries an equal share of area' },
            ]}
          />
        ) : (
          <Readouts
            items={[
              { label: 'Δx (east)', value: `${fix(dx, 1)} km` },
              { label: 'Δy (north)', value: `${fix(dy, 1)} km` },
              { label: 'straight-line distance', value: `${fix(d2, 3)} km`, accent: true },
              { label: '3-D distance', value: `${fix(d3, 3)} km` },
              { label: 'bearing', value: `${fix(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360, 1)}°` },
              { label: 'formula', value: `√(${fix(dx * dx, 2)} + ${fix(dy * dy, 2)})` },
            ]}
          />
        )
      }
    />
  );
}

function snapLen(v: number) {
  const r = Math.round(v);
  if (Math.abs(v - r) < 0.12) return clamp(r, 0.5, 12);
  return clamp(Math.round(v * 10) / 10, 0.5, 12);
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
