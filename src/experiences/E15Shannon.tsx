import { useMemo, useRef, useState } from 'react';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider } from '../components/Controls';
import { useCanvas, usePointer, useReducedMotion, useThrottledValue } from '../core/hooks';
import { FONT_MONO, FONT_SERIF, text } from '../core/draw';
import { binaryEntropy, expectedCodeLength, huffman, normalize, sampleDiscrete, shannonEntropy, surprisal, type HuffmanNode } from '../math/information';
import { clamp, fix, mulberry32 } from '../math/rng';

const SYMS = ['A', 'B', 'C', 'D', 'E', 'F'];
const COLS = ['#7dff9a', '#33c3ff', '#f7ff6b', '#ff8f6b', '#c48cff', '#ff6fb5'];

const PRESETS: Record<string, number[]> = {
  uniform4: [0.25, 0.25, 0.25, 0.25],
  skewed: [0.5, 0.2, 0.15, 0.1, 0.05],
  dyadic: [0.5, 0.25, 0.125, 0.125],
  deterministic: [1, 0, 0, 0],
  letters: normalize([12.7, 9.1, 8.2, 7.5, 7.0, 6.7]),
};

export default function Shannon() {
  const reduced = useReducedMotion();
  const [p, setP] = useState<number[]>([0.45, 0.25, 0.2, 0.1]);
  const [rate, setRate] = useState(5);
  const [running, setRunning] = useState(!reduced);
  const stream = useRef<{ s: number; x: number; code: string }[]>([]);
  const counts = useRef<number[]>(new Array(6).fill(0));
  const bits = useRef(0);
  const acc = useRef(0);
  const rng = useRef(mulberry32(42));
  const drag = useRef<number | null>(null);
  const n = p.length;

  const H = shannonEntropy(p);
  const { codes, tree } = useMemo(() => huffman(p), [p]);
  const L = expectedCodeLength(p, codes);
  const fixedBits = Math.max(1, Math.ceil(Math.log2(n)));

  useGoalWhen('sh-2bits', Math.abs(H - 2) < 0.005);
  useGoalWhen('sh-zero', H < 1e-6);
  useGoalWhen('sh-dyadic', H > 0.5 && Math.abs(L - H) < 1e-9);

  const emp = useThrottledValue(() => {
    const c = counts.current.slice(0, n);
    const tot = c.reduce((a, b) => a + b, 0);
    return { tot, bps: tot ? bits.current / tot : 0, Hs: tot ? shannonEntropy(c.map((x) => x / tot)) : 0 };
  }, 250);

  const resetStream = () => {
    stream.current = [];
    counts.current = new Array(6).fill(0);
    bits.current = 0;
  };

  const layout = (w: number, h: number) => {
    const mob = w < 760;
    const top = mob ? 112 : 150;
    const streamH = 74;
    const bodyH = h - top - streamH - 70;
    if (mob) {
      return {
        bars: { x: 30, y: top + 10, w: w - 50, h: bodyH * 0.55 },
        tree: { x: 16, y: top + bodyH * 0.62, w: w - 32, h: bodyH * 0.38 },
        stream: { x: 0, y: h - streamH - 58, w, h: streamH },
      };
    }
    const bw = Math.min(460, w * 0.42);
    return {
      bars: { x: 50, y: top + 16, w: bw, h: bodyH - 30 },
      tree: { x: 50 + bw + 50, y: top + 10, w: w - bw - 130, h: bodyH - 10 },
      stream: { x: 0, y: h - streamH - 58, w, h: streamH },
    };
  };

  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const lay = layout(w, h);
      // ── probability bars
      const b = lay.bars;
      const colW = b.w / n;
      ctx.strokeStyle = 'rgba(160,180,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = b.x + i * colW + colW * 0.18;
        const bwid = colW * 0.64;
        const hh = p[i] * (b.h - 50);
        const y = b.y + b.h - hh;
        const g = ctx.createLinearGradient(0, y, 0, b.y + b.h);
        g.addColorStop(0, COLS[i]);
        g.addColorStop(1, 'rgba(10,20,30,0.3)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.shadowColor = COLS[i];
        ctx.shadowBlur = drag.current === i ? 22 : 10;
        ctx.fillRect(x, y, bwid, hh);
        ctx.restore();
        // drag handle
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + bwid / 2 - 12, y - 3, 24, 4);
        text(ctx, SYMS[i], x + bwid / 2, b.y + b.h + 18, { align: 'center', size: 16, color: COLS[i], weight: 700 });
        text(ctx, fix(p[i], 3), x + bwid / 2, y - 10, { align: 'center', size: 11.5, color: '#fff', font: FONT_MONO });
        const s = surprisal(p[i]);
        text(ctx, Number.isFinite(s) ? `${fix(s, 2)} bits` : '∞', x + bwid / 2, b.y + b.h + 34, { align: 'center', size: 10, color: 'rgba(200,210,240,0.75)', font: FONT_MONO });
        text(ctx, codes[i] ?? '—', x + bwid / 2, b.y + b.h + 50, { align: 'center', size: 11, color: COLS[i], font: FONT_MONO });
      }
      text(ctx, 'probability  ·  surprise −log₂p  ·  Huffman code', b.x, b.y - 4, { size: 10.5, color: 'rgba(200,210,240,0.65)', font: FONT_MONO });

      // ── Huffman tree
      const t = lay.tree;
      if (tree && t.w > 120 && n > 2) {
        const depth = (nd: HuffmanNode): number => (nd.symbol !== undefined || (!nd.left && !nd.right) ? 0 : 1 + Math.max(nd.left ? depth(nd.left) : 0, nd.right ? depth(nd.right) : 0));
        const D = Math.max(1, depth(tree));
        const leaves: HuffmanNode[] = [];
        const collect = (nd: HuffmanNode) => {
          if (nd.symbol !== undefined) leaves.push(nd);
          if (nd.left) collect(nd.left);
          if (nd.right) collect(nd.right);
        };
        collect(tree);
        const pos = new Map<HuffmanNode, [number, number]>();
        let leafIdx = 0;
        const place = (nd: HuffmanNode, d: number): number => {
          let x: number;
          if (nd.symbol !== undefined) {
            x = t.x + ((leafIdx + 0.5) / Math.max(1, leaves.length)) * t.w;
            leafIdx++;
          } else {
            const xs = [nd.left, nd.right].filter(Boolean).map((c) => place(c!, d + 1));
            x = xs.reduce((a, v) => a + v, 0) / xs.length;
          }
          pos.set(nd, [x, t.y + 18 + (d / D) * (t.h - 60)]);
          return x;
        };
        place(tree, 0);
        const edge = (a: HuffmanNode, c: HuffmanNode | undefined, bit: string) => {
          if (!c) return;
          const [x1, y1] = pos.get(a)!;
          const [x2, y2] = pos.get(c)!;
          ctx.strokeStyle = 'rgba(160,190,255,0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          text(ctx, bit, (x1 + x2) / 2 + (bit === '0' ? -8 : 8), (y1 + y2) / 2, { align: 'center', size: 11, color: '#fff', font: FONT_MONO });
          edge(c, c.left, '0');
          edge(c, c.right, '1');
        };
        edge(tree, tree.left, '0');
        edge(tree, tree.right, '1');
        for (const [nd, [x, y]] of pos) {
          const leaf = nd.symbol !== undefined;
          ctx.fillStyle = leaf ? COLS[nd.symbol!] : 'rgba(20,30,60,0.95)';
          ctx.strokeStyle = leaf ? COLS[nd.symbol!] : 'rgba(160,190,255,0.6)';
          ctx.beginPath();
          ctx.arc(x, y, leaf ? 13 : 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          text(ctx, leaf ? SYMS[nd.symbol!] : fix(nd.weight, 2), x, y + (leaf ? 1 : -14), { align: 'center', baseline: 'middle', size: leaf ? 13 : 9.5, color: leaf ? '#03040a' : 'rgba(220,230,255,0.75)', weight: leaf ? 700 : 400, font: leaf ? undefined : FONT_MONO });
        }
        text(ctx, 'Huffman tree — merge the two rarest, repeat', t.x, t.y + 2, { size: 10.5, color: 'rgba(200,210,240,0.65)', font: FONT_MONO });
      }

      // ── symbol stream
      const st = lay.stream;
      ctx.fillStyle = 'rgba(8,12,26,0.7)';
      ctx.fillRect(st.x, st.y, st.w, st.h);
      if (running) {
        acc.current += dt * rate;
        while (acc.current >= 1) {
          acc.current -= 1;
          const s = sampleDiscrete(p, rng.current());
          const code = codes[s] ?? '';
          stream.current.push({ s, x: w + 20, code });
          counts.current[s]++;
          bits.current += code.length;
        }
      }
      const speed = 60 + rate * 14;
      for (let i = stream.current.length - 1; i >= 0; i--) {
        const tok = stream.current[i];
        if (running) tok.x -= speed * dt;
        if (tok.x < -60) {
          stream.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = COLS[tok.s];
        ctx.globalAlpha = 0.9;
        ctx.fillRect(tok.x - 12, st.y + 10, 24, 24);
        ctx.globalAlpha = 1;
        text(ctx, SYMS[tok.s], tok.x, st.y + 27, { align: 'center', size: 14, color: '#03040a', weight: 700 });
        text(ctx, tok.code, tok.x, st.y + 54, { align: 'center', size: 11, color: COLS[tok.s], font: FONT_MONO });
      }
      text(ctx, 'source  →  encoder  →  bits', st.x + 12, st.y + st.h + 14, { size: 10.5, color: 'rgba(200,210,240,0.6)', font: FONT_MONO });
      // binary entropy inset for two symbols
      if (n === 2) {
        const ix = lay.tree.x;
        const iy = lay.tree.y + 30;
        const iw = Math.min(lay.tree.w, 300);
        const ih = 140;
        ctx.strokeStyle = 'rgba(160,180,255,0.3)';
        ctx.strokeRect(ix, iy, iw, ih);
        ctx.beginPath();
        for (let k = 0; k <= 100; k++) {
          const q = k / 100;
          const y = iy + ih - binaryEntropy(q) * (ih - 10);
          if (k) ctx.lineTo(ix + q * iw, y);
          else ctx.moveTo(ix + q * iw, y);
        }
        ctx.strokeStyle = '#7dff9a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ix + p[0] * iw, iy + ih - binaryEntropy(p[0]) * (ih - 10), 5, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, 'H(p) for a coin with P(A) = p', ix + 6, iy + 14, { size: 10.5, color: 'rgba(200,210,240,0.75)', font: FONT_MONO });
        text(ctx, '1 bit: a fair coin', ix + iw / 2, iy + 26, { align: 'center', size: 11, color: '#7dff9a', font: FONT_SERIF, italic: true });
      }
    },
    { animate: true },
  );

  usePointer(canvasRef, {
    down: (pt) => {
      const el = canvasRef.current!;
      const b = layout(el.clientWidth, el.clientHeight).bars;
      if (pt.x < b.x || pt.x > b.x + b.w || pt.y < b.y - 20 || pt.y > b.y + b.h + 10) return false;
      drag.current = clamp(Math.floor(((pt.x - b.x) / b.w) * n), 0, n - 1);
      setFromPointer(pt.y);
    },
    move: (pt, dragging) => {
      if (dragging && drag.current !== null) setFromPointer(pt.y);
    },
    up: () => (drag.current = null),
  });

  function setFromPointer(py: number) {
    const el = canvasRef.current!;
    const b = layout(el.clientWidth, el.clientHeight).bars;
    let v = clamp((b.y + b.h - py) / (b.h - 50), 0, 1);
    if (Math.abs(v - 0.5) < 0.012) v = 0.5;
    if (Math.abs(v - 0.25) < 0.012) v = 0.25;
    if (Math.abs(v - 0.125) < 0.008) v = 0.125;
    setTo(drag.current!, v);
  }

  function setTo(i: number, v: number) {
    setP((old) => {
      const others = old.reduce((s, x, k) => (k === i ? s : s + x), 0);
      return old.map((x, k) => (k === i ? v : others > 1e-12 ? (x * (1 - v)) / others : (1 - v) / (old.length - 1)));
    });
    resetStream();
  }

  const setN = (k: number) => {
    setP(normalize(new Array(k).fill(1)));
    resetStream();
  };

  const reset = () => {
    setP([0.45, 0.25, 0.2, 0.1]);
    setRate(5);
    resetStream();
    setRunning(!reduced);
  };

  return (
    <ExperienceShell
      stage={<canvas ref={canvasRef} aria-label="Symbol probabilities, Huffman code tree and a stream of encoded symbols" />}
      onReset={reset}
      toolbar={
        <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
          {running ? 'Pause stream' : 'Stream'}
        </Btn>
      }
      notice={
        H < 1e-6 ? (
          <Callout tone="event">Completely predictable: the receiver already knows every symbol, so each carries 0 bits.</Callout>
        ) : Math.abs(L - H) < 1e-9 ? (
          <Callout tone="success">Every probability is a power of ½, so Huffman code lengths equal the surprisals exactly: L = H.</Callout>
        ) : Math.abs(H - Math.log2(n)) < 1e-6 ? (
          <Callout tone="event">Uniform: maximum uncertainty, H = log₂{n} = {fix(Math.log2(n), 3)} bits. Nothing can be compressed.</Callout>
        ) : undefined
      }
      controls={
        <>
          <ControlGroup title="Source">
            <Segmented
              label="Alphabet size"
              value={String(n)}
              onChange={(v) => setN(Number(v))}
              options={[2, 3, 4, 5, 6].map((k) => ({ value: String(k), label: String(k) }))}
            />
            <div className="btn-row">
              <Btn onClick={() => { setP(PRESETS.uniform4); resetStream(); }}>Uniform</Btn>
              <Btn onClick={() => { setP(PRESETS.skewed); resetStream(); }}>Skewed</Btn>
              <Btn onClick={() => { setP(PRESETS.dyadic); resetStream(); }}>½ ¼ ⅛ ⅛</Btn>
              <Btn onClick={() => { setP(PRESETS.deterministic); resetStream(); }}>Deterministic</Btn>
              <Btn onClick={() => { setP(PRESETS.letters); resetStream(); }}>Letter-like</Btn>
            </div>
            <p className="responds" style={{ margin: 0 }}>Drag any bar up or down; the others rescale so the probabilities always sum to 1.</p>
            {p.map((v, i) => (
              <Slider key={i} label={`P(${SYMS[i]})`} value={v} min={0} max={1} step={0.001} onChange={(x) => setTo(i, x)} format={(x) => fix(x, 3)} />
            ))}
          </ControlGroup>
          <ControlGroup title="Stream">
            <Slider label="Symbols per second" value={rate} min={1} max={20} step={1} onChange={setRate} format={(v) => String(Math.round(v))} />
            <Btn onClick={resetStream}>Clear statistics</Btn>
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'entropy H', value: `${fix(H, 4)} bits/symbol`, accent: true },
            { label: 'maximum log₂ n', value: `${fix(Math.log2(n), 4)} bits` },
            { label: 'Huffman average length L', value: `${fix(L, 4)} bits`, accent: true },
            { label: 'efficiency H / L', value: L > 0 ? `${fix((H / L) * 100, 1)}%` : '—' },
            { label: 'fixed-length code', value: `${fixedBits} bits/symbol` },
            { label: 'saving vs fixed-length', value: `${fix((1 - L / fixedBits) * 100, 1)}%` },
            { label: `streamed: ${emp.tot} symbols`, value: `${fix(emp.bps, 3)} bits/symbol` },
            { label: 'sample entropy', value: `${fix(emp.Hs, 3)} bits` },
          ]}
        />
      }
    />
  );
}
