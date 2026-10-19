import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store';

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Honour the OS setting unless the visitor overrides it in Settings. */
export function useReducedMotion(): boolean {
  const pref = useStore((s) => s.settings.motion);
  const [system, setSystem] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSystem(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return pref === 'reduced' || (pref === 'system' && system);
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [q]);
  return m;
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 860px)');
}

/** Rendering quality: low on small/touch screens or when the visitor asks for it. */
export function useQualityLow() {
  const q = useStore((s) => s.settings.quality);
  const small = useMediaQuery('(max-width: 700px)');
  return q === 'low' || (q === 'auto' && small);
}

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  w: number; // CSS pixels
  h: number;
  dpr: number;
  dt: number; // seconds since previous frame (clamped)
  time: number; // seconds since mount
}

/**
 * Drives a 2-D canvas: keeps its backing store sized to the element × devicePixelRatio,
 * and calls `draw` every animation frame while `animate` is true (or once per React render
 * otherwise). `draw` always sees the latest props/state via a ref, so React does not need to
 * re-render on every frame. Rendering pauses while the canvas is off-screen or the tab hidden.
 */
export function useCanvas(
  draw: (f: CanvasFrame) => void,
  opts: { animate: boolean; maxDpr?: number } = { animate: true },
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useLatest(draw);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const visible = useRef(true);
  const start = useRef(performance.now());
  const last = useRef(performance.now());
  const animate = opts.animate;
  const maxDpr = opts.maxDpr ?? 2;

  const renderOnce = useCallback(
    (dt: number) => {
      const c = canvasRef.current;
      if (!c || size.current.w === 0) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const { w, h, dpr } = size.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current({ ctx, w, h, dpr, dt, time: (performance.now() - start.current) / 1000 });
    },
    [drawRef],
  );

  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w !== size.current.w || h !== size.current.h || dpr !== size.current.dpr) {
        size.current = { w, h, dpr };
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        renderOnce(0);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    const io = new IntersectionObserver((entries) => {
      visible.current = entries[0]?.isIntersecting ?? true;
    });
    io.observe(c);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [renderOnce, maxDpr]);

  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    last.current = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      if (!visible.current || document.hidden) return;
      renderOnce(dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, renderOnce]);

  // static redraw after every render when not animating
  useEffect(() => {
    if (!animate) renderOnce(0);
  });

  return { canvasRef, size, redraw: () => renderOnce(0) };
}

export interface PointerInfo {
  x: number;
  y: number;
  dx: number;
  dy: number;
  id: number;
  buttons: number;
  event: PointerEvent;
}

/** Pointer handlers in element-local CSS pixels, with capture for smooth dragging. */
export function usePointer(
  ref: React.RefObject<HTMLElement | null>,
  handlers: {
    down?: (p: PointerInfo) => boolean | void;
    move?: (p: PointerInfo, dragging: boolean) => void;
    up?: (p: PointerInfo) => void;
    leave?: () => void;
  },
) {
  const h = useLatest(handlers);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const info = (e: PointerEvent): PointerInfo => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const out = { x, y, dx: x - lx, dy: y - ly, id: e.pointerId, buttons: e.buttons, event: e };
      lx = x;
      ly = y;
      return out;
    };
    const down = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      lx = e.clientX - r.left;
      ly = e.clientY - r.top;
      const res = h.current.down?.(info(e));
      if (res !== false) {
        dragging = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => h.current.move?.(info(e), dragging);
    const up = (e: PointerEvent) => {
      if (dragging) h.current.up?.(info(e));
      dragging = false;
    };
    const leave = () => h.current.leave?.();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
    };
  }, [ref, h]);
}

/** Request/frame loop independent of canvas (for simulations driving several canvases). */
export function useFrame(cb: (dt: number, time: number) => void, running = true) {
  const cbRef = useLatest(cb);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cbRef.current(dt, (now - t0) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, cbRef]);
}

/** Throttled state for readouts that change every frame (≈ 8 updates/s). */
export function useThrottledValue<T>(getter: () => T, interval = 120, running = true): T {
  const [v, setV] = useState(getter);
  const g = useLatest(getter);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setV(g.current()), interval);
    return () => window.clearInterval(id);
  }, [interval, running, g]);
  return v;
}

/** Shared palette helpers for canvas drawing. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
