import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Readouts, Segmented, Slider, Toggle } from '../components/Controls';
import { useCanvas, useLatest, usePointer, useQualityLow, useReducedMotion, useThrottledValue } from '../core/hooks';
import { FONT_MONO, text } from '../core/draw';
import { Wave1D, Wave2D, type WaveBoundary } from '../math/wave';
import { clamp, fix, mulberry32 } from '../math/rng';

type Dim = '2d' | '1d';
type Preset = 'drop' | 'two' | 'slit' | 'mode' | 'rain';
const AQUA = '#4cc9ff';

export default function WaveEquation() {
  const reduced = useReducedMotion();
  const low = useQualityLow();
  const N = low ? 96 : 128;
  const [dim, setDim] = useState<Dim>('2d');
  const [preset, setPreset] = useState<Preset>('drop');
  const [c, setC] = useState(0.8);
  const [freq, setFreq] = useState(0.06);
  const [damping, setDamping] = useState(0);
  const [boundary, setBoundary] = useState<WaveBoundary>('fixed');
  const [modeMN, setModeMN] = useState<[number, number]>([3, 2]);
  const [running, setRunning] = useState(!reduced);
  const [showProfile, setShowProfile] = useState(true);
  const [amp, setAmp] = useState(1);
  const [webgl, setWebgl] = useState(true);
  // 1-D
  const [left, setLeft] = useState<'fixed' | 'free'>('fixed');
  const [right, setRight] = useState<'fixed' | 'free'>('fixed');
  const [drive1d, setDrive1d] = useState(false);
  const [harmonicUsed, setHarmonicUsed] = useState(false);
  const [driveMult, setDriveMult] = useState(2);

  const sim2 = useRef<Wave2D>(new Wave2D(N));
  const sim1 = useRef<Wave1D>(new Wave1D(320));
  const env1 = useRef(new Float64Array(320));
  const acc = useRef(0);
  const rng = useRef(mulberry32(11));
  const mountRef = useRef<HTMLDivElement>(null);
  const params = useLatest({ preset, c, freq, damping, boundary, running, amp, dim, showProfile, left, right, drive1d, driveMult });
  const stepRef = useRef(0);

  useGoalWhen('w-standing', dim === '1d' && harmonicUsed);
  useGoalWhen('w-interf', dim === '2d' && (preset === 'two' || preset === 'slit'));
  useGoalWhen('w-absorb', dim === '2d' && boundary === 'absorbing');

  // re-create the membrane when resolution changes
  useEffect(() => {
    if (sim2.current.n !== N) sim2.current = new Wave2D(N);
  }, [N]);

  const setupPreset = (p: Preset, mn = modeMN) => {
    const w = sim2.current;
    w.reset();
    w.wall.fill(0);
    w.c = c;
    const n = w.n;
    if (p === 'drop') w.pulse(n * 0.5, n * 0.5, 1.2 * amp, n * 0.035);
    if (p === 'slit') {
      const row = Math.floor(n * 0.42);
      const gap = Math.max(2, Math.round(n * 0.035));
      const sep = Math.round(n * 0.16);
      for (let i = 0; i < n; i++) {
        const d1 = Math.abs(i - (n / 2 - sep / 2));
        const d2 = Math.abs(i - (n / 2 + sep / 2));
        if (d1 > gap / 2 && d2 > gap / 2) {
          w.wall[row * n + i] = 1;
          w.wall[(row + 1) * n + i] = 1;
        }
      }
    }
    if (p === 'mode') {
      w.boundary = 'fixed';
      setBoundary('fixed');
      w.mode(mn[0], mn[1], 0.9 * amp);
    }
  };

  // physics + Three.js rendering for the membrane
  useEffect(() => {
    const mount = mountRef.current!;
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
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 3.7, 4.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = 1.35;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.target.set(0, -0.2, 0);

    let n = sim2.current.n;
    const S = 4;
    let tex: THREE.DataTexture;
    let texData: Float32Array;
    let geo: THREE.BufferGeometry;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uH: { value: null },
        uTexel: { value: 1 / n },
        uAmp: { value: 0.32 },
        uCell: { value: S / (n - 1) },
        uLight: { value: new THREE.Vector3(0.4, 1, 0.35).normalize() },
      },
      vertexShader: /* glsl */ `
        uniform sampler2D uH;
        uniform float uTexel;
        uniform float uAmp;
        uniform float uCell;
        varying float vH;
        varying float vWall;
        varying vec3 vN;
        varying vec3 vWorld;
        void main() {
          vec2 t = texture2D(uH, uv).rg;
          float h = t.r;
          float hx = texture2D(uH, uv + vec2(uTexel, 0.0)).r - texture2D(uH, uv - vec2(uTexel, 0.0)).r;
          float hz = texture2D(uH, uv + vec2(0.0, uTexel)).r - texture2D(uH, uv - vec2(0.0, uTexel)).r;
          vec3 p = position;
          p.y += h * uAmp + t.g * 0.12;
          vH = h;
          vWall = t.g;
          vN = normalize(vec3(-hx * uAmp / (2.0 * uCell), 1.0, -hz * uAmp / (2.0 * uCell)));
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight;
        varying float vH;
        varying float vWall;
        varying vec3 vN;
        varying vec3 vWorld;
        void main() {
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vWorld);
          float diff = max(dot(n, uLight), 0.0);
          vec3 hlf = normalize(uLight + v);
          float spec = pow(max(dot(n, hlf), 0.0), 60.0);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          float h = clamp(vH * 1.4, -1.0, 1.0);
          vec3 deep = vec3(0.10, 0.05, 0.32);
          vec3 mid = vec3(0.02, 0.10, 0.22);
          vec3 crest = vec3(0.30, 0.86, 1.0);
          vec3 col = h > 0.0 ? mix(mid, crest, h) : mix(mid, deep, -h);
          col *= 0.45 + 0.75 * diff;
          col += spec * vec3(0.9, 0.95, 1.0) * 0.8 + fres * vec3(0.25, 0.3, 0.9) * 0.6;
          col += vec3(0.1, 0.5, 0.9) * pow(max(h, 0.0), 2.0) * 0.6;
          if (vWall > 0.5) col = vec3(0.85, 0.82, 1.0) * (0.35 + 0.5 * diff);
          // grid lines
          vec2 g = abs(fract(vWorld.xz * 2.0) - 0.5);
          float line = smoothstep(0.48, 0.5, max(g.x, g.y));
          col += line * 0.035;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(undefined, mat);
    scene.add(mesh);
    // frame around the membrane
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(S, 0.02, S)),
      new THREE.LineBasicMaterial({ color: 0x4cc9ff, transparent: true, opacity: 0.35 }),
    );
    scene.add(frame);
    const profileLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    scene.add(profileLine);

    const buildGeometry = () => {
      n = sim2.current.n;
      const pos = new Float32Array(n * n * 3);
      const uv = new Float32Array(n * n * 2);
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const k = j * n + i;
          pos[k * 3] = (i / (n - 1) - 0.5) * S;
          pos[k * 3 + 1] = 0;
          pos[k * 3 + 2] = (j / (n - 1) - 0.5) * S;
          uv[k * 2] = (i + 0.5) / n;
          uv[k * 2 + 1] = (j + 0.5) / n;
        }
      const idx: number[] = [];
      for (let j = 0; j < n - 1; j++)
        for (let i = 0; i < n - 1; i++) {
          const a = j * n + i;
          idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
        }
      geo?.dispose();
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      mesh.geometry = geo;
      texData = new Float32Array(n * n * 2);
      tex?.dispose();
      tex = new THREE.DataTexture(texData, n, n, THREE.RGFormat, THREE.FloatType);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      mat.uniforms.uH.value = tex;
      mat.uniforms.uTexel.value = 1 / n;
      mat.uniforms.uCell.value = S / (n - 1);
      const lp = new Float32Array(n * 3);
      profileLine.geometry.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    };
    buildGeometry();

    // click / tap to disturb
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let downAt: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (downAt = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const gi = (hit.x / S + 0.5) * (n - 1);
      const gj = (hit.z / S + 0.5) * (n - 1);
      if (gi < 1 || gj < 1 || gi > n - 2 || gj > n - 2) return;
      sim2.current.pulse(gi, gj, 1.1 * params.current.amp, n * 0.03);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    let raf = 0;
    let last = performance.now();
    let rainT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtf = Math.min(0.05, (now - last) / 1000);
      last = now;
      const P = params.current;
      if (document.hidden || P.dim !== '2d') return;
      const w = sim2.current;
      if (w.n !== n) buildGeometry();
      w.c = P.c;
      w.damping = P.damping;
      w.boundary = P.boundary;
      if (P.running) {
        acc.current += dtf * 40;
        let steps = 0;
        while (acc.current > w.dt && steps < 12) {
          const t = w.time;
          const s = Math.sin(2 * Math.PI * P.freq * t) * 0.9 * P.amp;
          if (P.preset === 'two') {
            w.drive(n * 0.38, n * 0.5, s, 1.2);
            w.drive(n * 0.62, n * 0.5, s, 1.2);
          } else if (P.preset === 'slit') {
            const row = 3;
            for (let i = 2; i < n - 2; i++) w.u[row * n + i] = s * 0.8;
          }
          w.step();
          acc.current -= w.dt;
          steps++;
          stepRef.current++;
        }
        if (P.preset === 'rain') {
          rainT += dtf;
          if (rainT > 0.35) {
            rainT = 0;
            w.pulse(4 + rng.current() * (n - 8), 4 + rng.current() * (n - 8), (0.5 + rng.current() * 0.7) * P.amp, n * 0.02);
          }
        }
      }
      for (let k = 0; k < n * n; k++) {
        texData[k * 2] = w.u[k];
        texData[k * 2 + 1] = w.wall[k];
      }
      tex.needsUpdate = true;
      // cross-section line on the surface (middle row)
      const lp = profileLine.geometry.attributes.position as THREE.BufferAttribute;
      const jm = Math.floor(n / 2);
      for (let i = 0; i < n; i++) {
        lp.setXYZ(i, (i / (n - 1) - 0.5) * S, w.u[jm * n + i] * 0.32 + 0.01, (jm / (n - 1) - 0.5) * S);
      }
      lp.needsUpdate = true;
      profileLine.visible = P.showProfile;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      geo?.dispose();
      tex?.dispose();
      mat.dispose();
      frame.geometry.dispose();
      profileLine.geometry.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [low, params]);

  // initial preset
  useEffect(() => {
    setupPreset('drop');
    sim1.current.setShape((x) => 0.9 * Math.exp(-(((x - 0.3) / 0.05) ** 2)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  // 2-D profile strip & the whole 1-D string share one canvas overlay
  const { canvasRef } = useCanvas(
    ({ ctx, w, h, dt }) => {
      ctx.clearRect(0, 0, w, h);
      const P = params.current;
      if (P.dim === '2d') {
        if (!P.showProfile) return;
        const s = sim2.current;
        const n = s.n;
        const jm = Math.floor(n / 2);
        const x0 = w * 0.2;
        const x1 = w - (w < 700 ? 16 : 24);
        const yc = h - 50;
        const H = 30;
        ctx.fillStyle = 'rgba(3,5,14,0.7)';
        ctx.fillRect(x0 - 10, yc - H - 14, x1 - x0 + 20, 2 * H + 22);
        ctx.strokeStyle = 'rgba(160,180,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(x0, yc);
        ctx.lineTo(x1, yc);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = AQUA;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = x0 + (i / (n - 1)) * (x1 - x0);
          const y = yc - clamp(s.u[jm * n + i], -1.5, 1.5) * H * 0.75;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        text(ctx, 'profile u(x) along the centre line', x0, yc - H - 2, { size: 10, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
        return;
      }
      // 1-D string
      const s = sim1.current;
      s.c = P.c;
      s.damping = P.damping;
      s.left = P.left;
      s.right = P.right;
      if (P.running) {
        const steps = Math.max(1, Math.round(3 * P.c * (dt * 60)));
        // natural frequencies of a fixed–fixed string: f_n = n c / 2L
        const f1 = s.c / (2 * (s.n - 1));
        for (let k = 0; k < steps; k++) {
          s.step();
          if (P.drive1d) s.u[0] = 0.05 * P.amp * Math.sin(2 * Math.PI * P.driveMult * f1 * s.time);
        }
      }
      const env = env1.current;
      const mob = w < 700;
      const x0 = mob ? 20 : 60;
      const x1 = w - (mob ? 20 : 40);
      const yc = h * 0.55;
      const A = Math.min(h * 0.22, 150);
      for (let i = 0; i < s.n; i++) env[i] = Math.max(Math.abs(s.u[i]), env[i] * 0.994);
      // envelope band reveals nodes and antinodes
      ctx.fillStyle = 'rgba(122,92,255,0.18)';
      ctx.beginPath();
      for (let i = 0; i < s.n; i++) ctx.lineTo(x0 + (i / (s.n - 1)) * (x1 - x0), yc - env[i] * A);
      for (let i = s.n - 1; i >= 0; i--) ctx.lineTo(x0 + (i / (s.n - 1)) * (x1 - x0), yc + env[i] * A);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,180,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(x0, yc);
      ctx.lineTo(x1, yc);
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = AQUA;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i < s.n; i++) {
        const x = x0 + (i / (s.n - 1)) * (x1 - x0);
        const y = yc - clamp(s.u[i], -2, 2) * A;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      // end supports
      for (const [x, kind] of [
        [x0, P.left],
        [x1, P.right],
      ] as [number, string][]) {
        ctx.fillStyle = kind === 'fixed' ? '#ffffff' : 'rgba(76,201,255,0.8)';
        if (kind === 'fixed') ctx.fillRect(x - 3, yc - A - 10, 6, 2 * A + 20);
        else {
          ctx.strokeStyle = 'rgba(76,201,255,0.6)';
          ctx.beginPath();
          ctx.moveTo(x, yc - A - 10);
          ctx.lineTo(x, yc + A + 10);
          ctx.stroke();
        }
        text(ctx, kind === 'fixed' ? 'fixed end' : 'free end (ring on a rod)', x, yc + A + 30, { align: 'center', size: 11, color: 'rgba(200,210,240,0.7)', font: FONT_MONO });
      }
    },
    { animate: true },
  );

  usePointer(canvasRef, {
    down: (p) => {
      if (dim !== '1d') return false;
      const el = canvasRef.current!;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const mob = w < 700;
      const x0 = mob ? 20 : 60;
      const x1 = w - (mob ? 20 : 40);
      const yc = h * 0.55;
      const A = Math.min(h * 0.22, 150);
      const xf = clamp((p.x - x0) / (x1 - x0), 0.02, 0.98);
      const yv = clamp((yc - p.y) / A, -1, 1);
      // pluck: triangle shape through the pointer
      sim1.current.reset();
      env1.current.fill(0);
      sim1.current.setShape((x) => (x < xf ? (yv * x) / xf : (yv * (1 - x)) / (1 - xf)));
    },
  });

  const harmonic = (m: number) => {
    setLeft('fixed');
    setRight('fixed');
    setDrive1d(false);
    sim1.current.left = 'fixed';
    sim1.current.right = 'fixed';
    env1.current.fill(0);
    sim1.current.c = c;
    sim1.current.harmonic(m, 0.8 * amp);
    setHarmonicUsed(true);
  };

  const reset = () => {
    setC(0.8);
    setFreq(0.06);
    setDamping(0);
    setBoundary('fixed');
    setAmp(1);
    setPreset('drop');
    setupPreset('drop');
    sim1.current.reset();
    env1.current.fill(0);
    sim1.current.setShape((x) => 0.9 * Math.exp(-(((x - 0.3) / 0.05) ** 2)));
    setLeft('fixed');
    setRight('fixed');
    setDrive1d(false);
    setDriveMult(2);
    setRunning(!reduced);
  };

  const live = useThrottledValue(() => ({ t: dim === '2d' ? sim2.current.time : sim1.current.time, e: dim === '2d' ? sim2.current.energy() : 0 }), 300);
  const wavelength = c / freq;
  const L1 = sim1.current.n - 1;

  return (
    <ExperienceShell
      stage={
        <>
          <div ref={mountRef} className="fill" style={{ visibility: dim === '2d' ? 'visible' : 'hidden' }} aria-label="Vibrating membrane — click or tap to make a disturbance" />
          {!webgl && dim === '2d' && <div className="error-box">WebGL is unavailable; switch to the 1-D string view.</div>}
          <canvas ref={canvasRef} style={{ pointerEvents: dim === '1d' ? 'auto' : 'none' }} aria-label={dim === '1d' ? 'Vibrating string — click to pluck' : 'Wave profile'} />
        </>
      }
      onReset={reset}
      toolbar={
        <>
          <Btn onClick={() => setRunning((r) => !r)} icon={running ? Icon.pause : Icon.play}>
            {running ? 'Pause' : 'Run'}
          </Btn>
          {!running && (
            <Btn
              onClick={() => {
                if (dim === '2d') sim2.current.step();
                else sim1.current.step();
              }}
              icon={Icon.step}
              title="Advance one time step"
            >
              Step
            </Btn>
          )}
        </>
      }
      notice={
        dim === '2d' && preset === 'slit' ? (
          <Callout tone="event">Each slit acts as a new source (Huygens). Where crests from the two slits meet, they add; where crest meets trough, they cancel.</Callout>
        ) : dim === '1d' && left !== right ? (
          <Callout tone="event">A pulse reflects <strong>upright</strong> from a free end but <strong>inverted</strong> from a fixed end.</Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented
            label="Medium"
            value={dim}
            onChange={setDim}
            options={[
              { value: '2d', label: '2-D membrane' },
              { value: '1d', label: '1-D string' },
            ]}
          />
          {dim === '2d' ? (
            <ControlGroup title="Scenario">
              <Segmented
                value={preset}
                onChange={(p) => {
                  setPreset(p);
                  setupPreset(p);
                }}
                options={[
                  { value: 'drop', label: 'Drop' },
                  { value: 'two', label: 'Two sources' },
                  { value: 'slit', label: 'Double slit' },
                  { value: 'mode', label: 'Standing mode' },
                  { value: 'rain', label: 'Rain' },
                ]}
              />
              {preset === 'mode' && (
                <div className="btn-row">
                  {[
                    [1, 1],
                    [2, 1],
                    [2, 2],
                    [3, 2],
                    [4, 3],
                  ].map(([m, q]) => (
                    <Btn
                      key={`${m}${q}`}
                      pressed={modeMN[0] === m && modeMN[1] === q}
                      onClick={() => {
                        setModeMN([m, q]);
                        setupPreset('mode', [m, q]);
                      }}
                    >
                      ({m},{q})
                    </Btn>
                  ))}
                </div>
              )}
              <p className="responds" style={{ margin: 0 }}>Click or tap the membrane to drop a disturbance. Drag to orbit.</p>
              <Segmented
                label="Boundary"
                value={boundary}
                onChange={(b) => {
                  setBoundary(b);
                  if (preset === 'mode' && b !== 'fixed') setPreset('drop');
                }}
                options={[
                  { value: 'fixed', label: 'Fixed (reflect, invert)' },
                  { value: 'free', label: 'Free (reflect)' },
                  { value: 'absorbing', label: 'Absorbing' },
                ]}
              />
            </ControlGroup>
          ) : (
            <ControlGroup title="String">
              <p className="responds" style={{ margin: 0 }}>Click the string to pluck it, or start a harmonic. The violet band records the envelope: still points are nodes.</p>
              <div className="btn-row">
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <Btn key={m} onClick={() => harmonic(m)}>
                    n = {m}
                  </Btn>
                ))}
              </div>
              <div className="btn-row">
                <Btn
                  onClick={() => {
                    sim1.current.reset();
                    env1.current.fill(0);
                    sim1.current.c = c;
                    sim1.current.travellingPulse(40, 10, 0.8 * amp);
                  }}
                >
                  Send a pulse →
                </Btn>
              </div>
              <div className="toggle-row">
                <Toggle label="Free left end" checked={left === 'free'} onChange={(v) => setLeft(v ? 'free' : 'fixed')} />
                <Toggle label="Free right end" checked={right === 'free'} onChange={(v) => setRight(v ? 'free' : 'fixed')} />
                <Toggle label="Drive left end" checked={drive1d} onChange={setDrive1d} tip="Shake the left end sinusoidally; near a natural frequency the string resonates." />
              </div>
              {drive1d && (
                <Slider label="Drive frequency" value={driveMult} min={0.5} max={6.5} step={0.01} onChange={setDriveMult} format={(v) => `${fix(v, 2)} × f₁`} tip="Whole-number multiples of the fundamental are resonances: the amplitude builds up (add damping to keep it bounded)." />
              )}
            </ControlGroup>
          )}
          <ControlGroup title="Physics">
            <Slider label="Wave speed" tex="c" value={c} min={0.2} max={1.4} step={0.01} onChange={setC} format={(v) => fix(v, 2)} unit="cells/τ" tip="The time step adjusts automatically to keep the Courant number below the stability limit." />
            {dim === '2d' && <Slider label="Source frequency" tex="f" value={freq} min={0.015} max={0.15} step={0.001} onChange={setFreq} format={(v) => fix(v, 3)} unit="1/τ" />}
            <Slider label="Damping" tex="\gamma" value={damping} min={0} max={0.08} step={0.001} onChange={setDamping} format={(v) => fix(v, 3)} />
            <Slider label="Amplitude" value={amp} min={0.2} max={1.6} step={0.01} onChange={setAmp} format={(v) => fix(v, 2)} />
            {dim === '2d' && <Toggle label="Show profile" checked={showProfile} onChange={setShowProfile} />}
          </ControlGroup>
        </>
      }
      readouts={
        <Readouts
          items={[
            { label: 'wavelength λ = c/f', value: `${fix(wavelength, 1)} cells`, accent: true },
            { label: 'Courant number', value: fix(dim === '2d' ? sim2.current.courant : 0.95, 3), hint: 'Stability needs ≤ 1/√2 in 2-D, ≤ 1 in 1-D' },
            dim === '2d'
              ? { label: 'membrane energy', value: fix(live.e, 2) }
              : { label: 'fundamental f₁ = c/2L', value: `${(c / (2 * L1)).toExponential(2)} /τ` },
            { label: 'simulated time', value: `${fix(live.t, 0)} τ` },
          ]}
        />
      }
    />
  );
}
