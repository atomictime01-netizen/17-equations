/** Canvas 2-D drawing helpers shared by the experiences. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Mapper {
  X: (x: number) => number;
  Y: (y: number) => number;
  invX: (px: number) => number;
  invY: (py: number) => number;
  rect: Rect;
  xr: [number, number];
  yr: [number, number];
}

export function mapper(rect: Rect, xr: [number, number], yr: [number, number]): Mapper {
  const sx = rect.w / (xr[1] - xr[0]);
  const sy = rect.h / (yr[1] - yr[0]);
  return {
    X: (x) => rect.x + (x - xr[0]) * sx,
    Y: (y) => rect.y + rect.h - (y - yr[0]) * sy,
    invX: (px) => xr[0] + (px - rect.x) / sx,
    invY: (py) => yr[0] + (rect.y + rect.h - py) / sy,
    rect,
    xr,
    yr,
  };
}

export const FONT_MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
export const FONT_SANS = '"Inter Variable", Inter, system-ui, sans-serif';
export const FONT_SERIF = '"Instrument Serif", Georgia, serif';

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  o: { color?: string; size?: number; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; weight?: number | string; italic?: boolean; shadow?: boolean } = {},
) {
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 12}px ${o.font ?? FONT_SANS}`;
  ctx.fillStyle = o.color ?? 'rgba(232,237,251,0.9)';
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
  }
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** Grid lines and labelled axes inside a mapper's rectangle. */
export function axes(
  ctx: CanvasRenderingContext2D,
  m: Mapper,
  o: { xStep?: number; yStep?: number; xLabel?: string; yLabel?: string; color?: string; labels?: boolean; fmtX?: (v: number) => string; fmtY?: (v: number) => string; zeroLines?: boolean } = {},
) {
  const { rect, xr, yr } = m;
  ctx.save();
  ctx.lineWidth = 1;
  const xStep = o.xStep ?? niceStep(xr[1] - xr[0]);
  const yStep = o.yStep ?? niceStep(yr[1] - yr[0]);
  ctx.strokeStyle = o.color ?? 'rgba(140,160,255,0.08)';
  ctx.beginPath();
  for (let x = Math.ceil(xr[0] / xStep) * xStep; x <= xr[1] + 1e-9; x += xStep) {
    const px = Math.round(m.X(x)) + 0.5;
    ctx.moveTo(px, rect.y);
    ctx.lineTo(px, rect.y + rect.h);
  }
  for (let y = Math.ceil(yr[0] / yStep) * yStep; y <= yr[1] + 1e-9; y += yStep) {
    const py = Math.round(m.Y(y)) + 0.5;
    ctx.moveTo(rect.x, py);
    ctx.lineTo(rect.x + rect.w, py);
  }
  ctx.stroke();
  if (o.zeroLines !== false) {
    ctx.strokeStyle = 'rgba(180,195,255,0.28)';
    ctx.beginPath();
    if (yr[0] <= 0 && yr[1] >= 0) {
      ctx.moveTo(rect.x, m.Y(0));
      ctx.lineTo(rect.x + rect.w, m.Y(0));
    }
    if (xr[0] <= 0 && xr[1] >= 0) {
      ctx.moveTo(m.X(0), rect.y);
      ctx.lineTo(m.X(0), rect.y + rect.h);
    }
    ctx.stroke();
  }
  if (o.labels !== false) {
    const fx = o.fmtX ?? ((v: number) => trimNum(v));
    const fy = o.fmtY ?? ((v: number) => trimNum(v));
    for (let x = Math.ceil(xr[0] / xStep) * xStep; x <= xr[1] + 1e-9; x += xStep)
      text(ctx, fx(x), m.X(x), rect.y + rect.h + 13, { size: 10, color: 'rgba(150,165,205,0.7)', align: 'center', font: FONT_MONO });
    for (let y = Math.ceil(yr[0] / yStep) * yStep; y <= yr[1] + 1e-9; y += yStep)
      text(ctx, fy(y), rect.x - 6, m.Y(y) + 3, { size: 10, color: 'rgba(150,165,205,0.7)', align: 'right', font: FONT_MONO });
  }
  if (o.xLabel) text(ctx, o.xLabel, rect.x + rect.w, rect.y + rect.h - 6, { size: 11, color: 'rgba(180,190,230,0.75)', align: 'right', italic: true, font: FONT_SERIF });
  if (o.yLabel) text(ctx, o.yLabel, rect.x + 6, rect.y + 13, { size: 11, color: 'rgba(180,190,230,0.75)', italic: true, font: FONT_SERIF });
  ctx.restore();
}

export function niceStep(span: number, target = 6) {
  const raw = span / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

export function trimNum(v: number) {
  if (Math.abs(v) < 1e-10) return '0';
  const s = Math.abs(v) >= 1000 || Math.abs(v) < 0.01 ? v.toExponential(0) : String(Number(v.toPrecision(4)));
  return s.replace('-', '−');
}

export function polyline(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>, n = xs.length) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) (i ? ctx.lineTo(xs[i], ys[i]) : ctx.moveTo(xs[i], ys[i]));
}

/** Stroke the current path twice: a wide soft glow and a crisp core. */
export function glowStroke(ctx: CanvasRenderingContext2D, color: string, width = 2, glow = 10) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(0.6, width * 0.35);
  ctx.stroke();
  ctx.restore();
}

export function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 2, head = 9, glow = 0) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * h * 0.6, y2 - uy * h * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * h - uy * h * 0.5, y2 - uy * h + ux * h * 0.5);
  ctx.lineTo(x2 - ux * h + uy * h * 0.5, y2 - uy * h - ux * h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow = 0) {
  ctx.save();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draggable handle: ring + core. */
export function handle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, active = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = active ? 1 : 0.8;
  ctx.beginPath();
  ctx.arc(x, y, active ? 12 : 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  dot(ctx, x, y, active ? 5 : 4, '#fff', 12);
}

/** Viridis-like perceptual colour map (t in 0..1) → [r,g,b]. */
export function colormap(t: number, scheme: 'magma' | 'ice' | 'diverge' = 'magma'): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  if (scheme === 'diverge') {
    // blue (0) – near black (0.5) – orange (1)
    if (t < 0.5) {
      const u = (0.5 - t) * 2;
      return [20 + 40 * u, 30 + 140 * u, 40 + 215 * u];
    }
    const u = (t - 0.5) * 2;
    return [20 + 235 * u, 30 + 120 * u, 40 + 10 * u];
  }
  if (scheme === 'ice') return [10 + 80 * t * t, 20 + 200 * t, 40 + 215 * Math.sqrt(t)];
  // magma-ish
  const r = 255 * Math.min(1, 1.6 * t);
  const g = 255 * Math.max(0, Math.min(1, (t - 0.35) * 1.6));
  const b = 255 * (0.25 + 0.5 * Math.sin(Math.PI * t));
  return [r, g, b];
}

/**
 * Marching squares: returns line segments [x1, y1, x2, y2] (in sample-grid coordinates) where the
 * sampled scalar field crosses `level`. `vals` is a (gw+1)×(gh+1) grid, row-major.
 */
export function contourSegments(vals: Float64Array, gw: number, gh: number, level: number): number[] {
  const out: number[] = [];
  const W = gw + 1;
  const interp = (a: number, b: number) => (level - a) / (b - a || 1e-12);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const v0 = vals[j * W + i];
      const v1 = vals[j * W + i + 1];
      const v2 = vals[(j + 1) * W + i + 1];
      const v3 = vals[(j + 1) * W + i];
      if (!isFinite(v0 + v1 + v2 + v3)) continue;
      const c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const pts: [number, number][] = [];
      // edges: top (0-1), right (1-2), bottom (2-3), left (3-0)
      if ((c & 1) !== (c & 2) >> 1) pts.push([i + interp(v0, v1), j]);
      if (((c & 2) >> 1) !== ((c & 4) >> 2)) pts.push([i + 1, j + interp(v1, v2)]);
      if (((c & 4) >> 2) !== ((c & 8) >> 3)) pts.push([i + 1 - interp(v2, v3), j + 1]);
      if (((c & 8) >> 3) !== (c & 1)) pts.push([i, j + 1 - interp(v3, v0)]);
      if (pts.length === 2) out.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      else if (pts.length === 4) out.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    }
  return out;
}
