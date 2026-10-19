import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { useCanvas, useLatest, useQualityLow, useReducedMotion } from '../core/hooks';
import { FONT_MONO, text } from '../core/draw';
import { blackScholes, interpGrid, intrinsic, solveBSPDE, type OptionKind } from '../math/blackscholes';
import { fix } from '../math/rng';

const EMERALD = '#4dffb0';
const GOLD = '#ffcf5c';
const BLUE = '#5c9dff';
const NS = 64;
const NT = 44;
const TMAX = 2;

export default function BlackScholes() {
  const reduced = useReducedMotion();
  const low = useQualityLow();
  const [kind, setKind] = useState<OptionKind>('call');
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [T, setT] = useState(1);
  const [sigma, setSigma] = useState(0.2);
  const [r, setR] = useState(0.05);
  const [showPDE, setShowPDE] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [spin, setSpin] = useState(!reduced);
  const [webgl, setWebgl] = useState(true);
  const mountRef = useRef<HTMLDivElement>(null);
  const params = useLatest({ kind, S, K, T, sigma, r, showGrid, spin });
  const dirty = useRef(true);
  useEffect(() => {
    dirty.current = true;
  }, [kind, S, K, T, sigma, r, showGrid]);

  const res = blackScholes(kind, { S, K, T, sigma, r });
  const other = blackScholes(kind === 'call' ? 'put' : 'call', { S, K, T, sigma, r });
  const deferred = useDeferredValue({ kind, K, T, sigma, r });
  const pde = useMemo(() => solveBSPDE(deferred.kind, { K: deferred.K, T: deferred.T, sigma: deferred.sigma, r: deferred.r }, { nS: 300, nT: 300 }), [deferred]);
  const pdePrice = interpGrid(pde.S, pde.V, S);
  const diff = pdePrice - res.price;
  const intr = intrinsic(kind, S, K);
  const callP = kind === 'call' ? res.price : other.price;
  const putP = kind === 'put' ? res.price : other.price;

  useGoalWhen('bs-vol', sigma >= 0.39);
  useGoalWhen('bs-expiry', T <= 0.01);
  useGoalWhen('bs-pde', showPDE && Math.abs(diff) < 0.05);

  // ── 3-D surface ─────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current!;
    dirty.current = true; // a freshly created scene must build its surface
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setWebgl(false);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x03040a, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    const labels = new CSS2DRenderer();
    labels.setSize(mount.clientWidth, mount.clientHeight);
    labels.domElement.className = 'bs-labels';
    mount.appendChild(labels.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(5.4, 3.3, 5.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.target.set(0.2, 0.35, 0);
    controls.autoRotateSpeed = 0.5;
    scene.add(new THREE.AmbientLight(0x6070a0, 0.8));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4);
    dl.position.set(3, 6, 4);
    scene.add(dl);
    const pl = new THREE.PointLight(0x4dffb0, 8, 12);
    pl.position.set(-3, 2, -2);
    scene.add(pl);

    const W = 4.2;
    const D = 3.2;
    const Hs = 1.35;
    const geo = new THREE.PlaneGeometry(W, D, NS - 1, NT - 1);
    geo.rotateX(-Math.PI / 2);
    const colors = new Float32Array(NS * NT * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.15, transparent: true, opacity: 0.92 });
    const surf = new THREE.Mesh(geo, mat);
    scene.add(surf);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: 0x9fffd6, transparent: true, opacity: 0.12 }));
    scene.add(wire);
    const lineMat = (c: number, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o });
    const payoff = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: NS }, () => new THREE.Vector3())), lineMat(0xffcf5c));
    const slice = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, () => new THREE.Vector3())), lineMat(0xffffff));
    scene.add(payoff, slice);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(marker);
    const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat(0xffffff, 0.5));
    scene.add(stem);
    // axes
    const axes = new THREE.Group();
    const ax = (a: THREE.Vector3, b: THREE.Vector3) => axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineMat(0x8fa0d0, 0.6)));
    ax(new THREE.Vector3(-W / 2, 0, D / 2), new THREE.Vector3(W / 2, 0, D / 2));
    ax(new THREE.Vector3(-W / 2, 0, D / 2), new THREE.Vector3(-W / 2, 0, -D / 2));
    ax(new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(-W / 2, Hs * 1.2, -D / 2));
    scene.add(axes);
    const label = (txt: string, pos: THREE.Vector3) => {
      const el = document.createElement('div');
      el.className = 'bs-label';
      el.textContent = txt;
      const o = new CSS2DObject(el);
      o.position.copy(pos);
      scene.add(o);
      return o;
    };
    label('stock price S →', new THREE.Vector3(0.6, -0.05, D / 2 + 0.3));
    label('time to expiry τ →', new THREE.Vector3(-W / 2 - 0.35, -0.05, 0));
    label('option value V', new THREE.Vector3(-W / 2, Hs * 1.25, -D / 2));
    const strikeLabel = label('K', new THREE.Vector3());

    const Smax = () => params.current.K * 2.2;
    const toX = (s: number) => (s / Smax()) * W - W / 2;
    const toZ = (tau: number) => D / 2 - (tau / TMAX) * D;
    const toY = (v: number) => (v / params.current.K) * Hs;
    const col = new THREE.Color();

    const rebuild = () => {
      const P = params.current;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      let vmax = 1e-9;
      const vals = new Float64Array(NS * NT);
      // PlaneGeometry rows run from −D/2 (far) to +D/2 (near) after rotation: row j ↔ τ = TMAX·(1 − j/(NT−1))
      for (let j = 0; j < NT; j++)
        for (let i = 0; i < NS; i++) {
          const s = (i / (NS - 1)) * Smax();
          const tau = TMAX * (1 - j / (NT - 1));
          const v = blackScholes(P.kind, { S: Math.max(s, 1e-6), K: P.K, T: tau, sigma: P.sigma, r: P.r }).price;
          vals[j * NS + i] = v;
          vmax = Math.max(vmax, v);
        }
      for (let j = 0; j < NT; j++)
        for (let i = 0; i < NS; i++) {
          const k = j * NS + i;
          const v = vals[k];
          pos.setY(k, toY(v));
          const t = Math.min(1, v / vmax);
          col.setRGB(0.18 + 0.82 * t * t, 0.55 + 0.35 * t, 0.62 - 0.35 * t);
          colors[k * 3] = col.r;
          colors[k * 3 + 1] = col.g;
          colors[k * 3 + 2] = col.b;
        }
      pos.needsUpdate = true;
      (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      geo.computeVertexNormals();
      wire.geometry.dispose();
      wire.geometry = new THREE.WireframeGeometry(geo);
      wire.visible = P.showGrid;
      // payoff at expiry and the current-τ slice
      const pp = payoff.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < NS; i++) {
        const s = (i / (NS - 1)) * Smax();
        pp.setXYZ(i, toX(s), toY(intrinsic(P.kind, s, P.K)) + 0.01, toZ(0));
      }
      pp.needsUpdate = true;
      const sp = slice.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 120; i++) {
        const s = (i / 119) * Smax();
        const v = blackScholes(P.kind, { S: Math.max(s, 1e-6), K: P.K, T: P.T, sigma: P.sigma, r: P.r }).price;
        sp.setXYZ(i, toX(s), toY(v) + 0.012, toZ(P.T));
      }
      sp.needsUpdate = true;
      const vNow = blackScholes(P.kind, { S: P.S, K: P.K, T: P.T, sigma: P.sigma, r: P.r }).price;
      marker.position.set(toX(Math.min(P.S, Smax())), toY(vNow), toZ(P.T));
      const st = stem.geometry.attributes.position as THREE.BufferAttribute;
      st.setXYZ(0, marker.position.x, 0, marker.position.z);
      st.setXYZ(1, marker.position.x, marker.position.y, marker.position.z);
      st.needsUpdate = true;
      strikeLabel.element.textContent = `K = ${fix(P.K, 0)}`;
      strikeLabel.position.set(toX(P.K), -0.05, D / 2 + 0.12);
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (dirty.current) {
        dirty.current = false;
        rebuild();
      }
      controls.autoRotate = params.current.spin;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    };
  }, [low, params]);

  // ── 2-D price slice inset ───────────────────────────────
  const { canvasRef } = useCanvas(
    ({ ctx, w, h }) => {
      ctx.clearRect(0, 0, w, h);
      const mob = w < 760;
      const iw = mob ? w - 24 : Math.min(420, w * 0.42);
      const ih = mob ? 150 : 190;
      const ix = mob ? 12 : w - iw - 18;
      const iy = h - ih - (mob ? 56 : 64);
      ctx.fillStyle = 'rgba(4,8,18,0.86)';
      ctx.strokeStyle = 'rgba(77,255,176,0.3)';
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeRect(ix, iy, iw, ih);
      const smax = K * 2.2;
      const vmax = Math.max(blackScholes(kind, { S: smax, K, T: TMAX, sigma, r }).price, K * 0.6, kind === 'put' ? K : 0) * 1.05;
      const X = (s: number) => ix + 30 + (s / smax) * (iw - 44);
      const Y = (v: number) => iy + ih - 22 - (v / vmax) * (ih - 40);
      ctx.strokeStyle = 'rgba(160,180,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(smax), Y(0));
      ctx.stroke();
      // intrinsic / payoff
      ctx.strokeStyle = GOLD;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const s = (i / 100) * smax;
        (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(s), Y(intrinsic(kind, s, K)));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // analytic price
      ctx.save();
      ctx.strokeStyle = EMERALD;
      ctx.shadowColor = EMERALD;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const s = Math.max((i / 160) * smax, 1e-6);
        (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(s), Y(blackScholes(kind, { S: s, K, T, sigma, r }).price));
      }
      ctx.stroke();
      ctx.restore();
      if (showPDE) {
        ctx.fillStyle = BLUE;
        for (let i = 0; i < pde.S.length; i += 8) {
          if (pde.S[i] > smax) break;
          ctx.beginPath();
          ctx.arc(X(pde.S[i]), Y(pde.V[i]), 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // marker
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(X(S), Y(res.price), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(X(K), iy + 18);
      ctx.lineTo(X(K), Y(0));
      ctx.stroke();
      text(ctx, 'K', X(K), Y(0) + 13, { align: 'center', size: 10, color: 'rgba(220,230,255,0.7)', font: FONT_MONO });
      text(ctx, `V(S) at τ = ${fix(T, 2)} yr`, ix + 10, iy + 15, { size: 10.5, color: EMERALD, font: FONT_MONO });
      text(ctx, 'payoff', ix + iw - 10, iy + 15, { align: 'right', size: 10.5, color: GOLD, font: FONT_MONO });
      if (showPDE) text(ctx, '• PDE (Crank–Nicolson)', ix + iw - 10, iy + 29, { align: 'right', size: 10.5, color: BLUE, font: FONT_MONO });
    },
    { animate: false },
  );

  const reset = () => {
    setKind('call');
    setS(100);
    setK(100);
    setT(1);
    setSigma(0.2);
    setR(0.05);
    setShowPDE(false);
    setSpin(!reduced);
  };

  return (
    <ExperienceShell
      stage={
        <>
          <div ref={mountRef} className="fill" aria-label="Option value surface over stock price and time to expiry. Drag to rotate." />
          {!webgl && <div className="error-box">WebGL is unavailable; the 2-D price curve and all numbers below still work.</div>}
          <canvas ref={canvasRef} style={{ pointerEvents: 'none' }} aria-hidden />
        </>
      }
      onReset={reset}
      toolbar={
        <Btn onClick={() => setSpin((s) => !s)} icon={spin ? Icon.pause : Icon.play}>
          {spin ? 'Stop orbit' : 'Orbit'}
        </Btn>
      }

      legend={
        <>
          <span className="legend-item"><i className="legend-swatch" style={{ background: EMERALD }} /> value surface V(S, τ)</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: GOLD }} /> payoff at expiry</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: '#fff' }} /> current τ slice</span>
        </>
      }
      controls={
        <>
          <Callout tone="warn">
            <strong>Illustrative mathematics, not investment advice.</strong> The model assumes constant volatility, frictionless trading and no jumps.
          </Callout>
          <Segmented
            label="European option"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'call', label: 'Call — right to buy' },
              { value: 'put', label: 'Put — right to sell' },
            ]}
          />
          <ControlGroup title="Market & contract">
            <Slider label="Stock price" tex="S" value={S} min={10} max={220} step={0.5} onChange={setS} format={(v) => fix(v, 1)} />
            <Slider label="Strike" tex="K" value={K} min={50} max={150} step={1} onChange={setK} format={(v) => fix(v, 0)} />
            <Slider label="Time to expiry" tex="T" value={T} min={0.001} max={TMAX} step={0.001} onChange={setT} format={(v) => (v < 0.1 ? `${fix(v * 365, 1)} days` : `${fix(v, 2)} yr`)} />
            <Slider label="Volatility" tex="\sigma" value={sigma} min={0.05} max={0.8} step={0.005} onChange={setSigma} format={(v) => `${fix(v * 100, 1)}%`} />
            <Slider label="Risk-free rate" tex="r" value={r} min={0} max={0.1} step={0.0025} onChange={setR} format={(v) => `${fix(v * 100, 2)}%`} />
          </ControlGroup>
          <div className="toggle-row">
            <Toggle label="Numerical PDE solution" checked={showPDE} onChange={setShowPDE} tip="Crank–Nicolson finite differences on 300 price points, marched backwards from the payoff." />
            <Toggle label="Surface grid" checked={showGrid} onChange={setShowGrid} />
          </div>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: `${kind} price (closed form)`, value: fix(res.price, 4), accent: true },
            { label: 'PDE price (Crank–Nicolson)', value: showPDE ? fix(pdePrice, 4) : 'turn on ↑' },
            { label: 'PDE − formula', value: showPDE ? fix(diff, 4) : '—' },
            { label: 'intrinsic value', value: fix(intr, 4) },
            { label: 'time value', value: fix(res.price - intr, 4) },
            { label: 'Δ delta', value: fix(res.delta, 4) },
            { label: 'Γ gamma', value: fix(res.gamma, 5) },
            { label: 'ν vega (per 1% σ)', value: fix(res.vega / 100, 4) },
            { label: 'Θ theta (per day)', value: fix(res.theta / 365, 4) },
            { label: 'ρ rho (per 1% r)', value: fix(res.rho / 100, 4) },
            { label: 'C − P', value: fix(callP - putP, 4) },
            { label: 'S − K e^{−rT} (parity)', value: fix(S - K * Math.exp(-r * T), 4) },
          ]}
        />
      }
    />
  );
}
