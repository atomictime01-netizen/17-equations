import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { actions, useStore } from '../core/store';
import { audio } from '../core/audio';
import { navigate } from '../core/router';
import { useQualityLow, useReducedMotion } from '../core/hooks';
import { mulberry32, smoothstep } from '../math/rng';
import { Tex } from './Tex';

type FormationFn = (i: number, t: number, out: Float32Array, o: number) => void;

const CAPTIONS: (string | null)[] = [
  null,
  'a^2 + b^2 = c^2',
  '\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u',
  'F = G\\frac{m_1 m_2}{r^2}',
  'e^{i\\theta} = \\cos\\theta + i\\sin\\theta',
  null,
];
// start times of each formation (seconds)
const TIMES = [0, 0.7, 2.95, 5.2, 7.45, 9.6];
const MORPH = 1.25;

export function Intro() {
  const seen = useStore((s) => s.introSeen);
  const reduced = useReducedMotion();
  const low = useQualityLow();
  const mountRef = useRef<HTMLDivElement>(null);
  const startAtEnd = useRef(seen || reduced);
  const [stage, setStage] = useState(startAtEnd.current ? 5 : 0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    } catch {
      setWebgl(false);
      setStage(5);
      setReady(true);
      return;
    }
    const N = low ? 4200 : 11000;
    const rand = mulberry32(17);
    const seeds = new Float32Array(N * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.25 : 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x020309, 1);
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020309, 0.018);
    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 0, 24);

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    for (let i = 0; i < N; i++) size[i] = 0.6 + seeds[i * 4 + 3] * 1.4;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uScale: { value: renderer.getPixelRatio() * (low ? 26 : 22) }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uScale;
        uniform float uFade;
        void main() {
          vColor = color * uFade;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // sprites are drawn larger than the core so each point carries its own soft halo (no post-process bloom)
          gl_PointSize = aSize * uScale * 2.4 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float core = smoothstep(0.42, 0.0, d);
          float halo = exp(-d * d * 7.0) * 0.22;
          float a = core * core + halo;
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);


    // ── formations ────────────────────────────────────────────
    const s = (i: number, k: number) => seeds[i * 4 + k];
    const palettes: [number, number, number][][] = [
      [[0.55, 0.65, 1], [0.8, 0.85, 1]],
      [[1, 0.78, 0.38], [0.37, 0.9, 1], [1, 0.48, 0.71]],
      [[0.3, 0.79, 1], [0.48, 0.36, 1]],
      [[1, 0.69, 0.34], [0.42, 0.66, 1]],
      [[0.71, 0.55, 1], [1, 0.44, 0.71]],
      [[0.37, 0.9, 1], [0.63, 0.52, 1], [1, 1, 1]],
    ];
    const dust: FormationFn = (i, t, out, o) => {
      const u = s(i, 0) * 2 - 1;
      const th = s(i, 1) * Math.PI * 2 + t * 0.05;
      const r = 6 + 14 * Math.cbrt(s(i, 2));
      const q = Math.sqrt(1 - u * u);
      out[o] = r * q * Math.cos(th);
      out[o + 1] = r * u;
      out[o + 2] = r * q * Math.sin(th);
    };
    // right triangle with squares (a = 3, b = 4, c = 5), scaled
    const SC = 0.95;
    const A = [-2.2, -1.6];
    const tri: FormationFn = (i, t, out, o) => {
      const sel = s(i, 0);
      const u = s(i, 1);
      const v = s(i, 2);
      let x = 0;
      let y = 0;
      const a = 3 * SC;
      const b = 4 * SC;
      // vertices: right angle at origin (A), B=(b,0), C=(0,a)
      if (sel < 0.12) {
        // triangle outline
        const e = Math.floor(u * 3);
        const w = v;
        if (e === 0) { x = w * b; y = 0; }
        else if (e === 1) { x = 0; y = w * a; }
        else { x = b * (1 - w); y = a * w; }
      } else {
        const k = (sel - 0.12) / 0.88;
        // shares proportional to areas: a² : b² : c² = 9 : 16 : 25 (total 50)
        if (k < 9 / 50) { x = -u * a; y = v * a; }
        else if (k < 25 / 50) { x = u * b; y = -v * b; }
        else {
          // square on the hypotenuse B→C, extended along the outward normal (a, b)/c
          x = b - b * u + v * a;
          y = a * u + v * b;
        }
      }
      const rot = Math.sin(t * 0.35) * 0.35;
      const X = x + A[0];
      const Y = y + A[1];
      out[o] = X * Math.cos(rot);
      out[o + 1] = Y;
      out[o + 2] = X * Math.sin(rot) + (s(i, 3) - 0.5) * 0.25;
    };
    const G = Math.floor(Math.sqrt(N));
    const wave: FormationFn = (i, t, out, o) => {
      const gx = (i % G) / G - 0.5;
      const gz = Math.floor(i / G) / G - 0.5;
      const x = gx * 22;
      const z = gz * 22;
      const r = Math.hypot(x + 3, z);
      const r2 = Math.hypot(x - 4, z + 2);
      const y = (0.9 * Math.sin(r * 1.35 - t * 3)) / (1 + 0.18 * r) + (0.7 * Math.sin(r2 * 1.35 - t * 3)) / (1 + 0.18 * r2);
      out[o] = x;
      out[o + 1] = y - 1.5 + gz * 4;
      out[o + 2] = z;
    };
    const orbit: FormationFn = (i, t, out, o) => {
      const sel = s(i, 0);
      if (sel < 0.07) {
        const u = s(i, 1) * 2 - 1;
        const th = s(i, 2) * Math.PI * 2;
        const r = 0.9 * Math.cbrt(s(i, 3));
        out[o] = r * Math.sqrt(1 - u * u) * Math.cos(th);
        out[o + 1] = r * u;
        out[o + 2] = r * Math.sqrt(1 - u * u) * Math.sin(th);
        return;
      }
      const k = Math.floor(s(i, 1) * 5);
      const aAx = 3 + k * 2.1;
      const e = [0.05, 0.25, 0.12, 0.45, 0.3][k];
      const inc = [0.2, -0.35, 0.5, -0.15, 0.3][k];
      const n = Math.pow(aAx, -1.5) * 6; // Kepler: ω ∝ a^{-3/2}
      const M = s(i, 2) * Math.PI * 2 + t * n;
      // approximate eccentric anomaly
      let E = M;
      for (let it = 0; it < 4; it++) E = M + e * Math.sin(E);
      const x = aAx * (Math.cos(E) - e);
      const y = aAx * Math.sqrt(1 - e * e) * Math.sin(E);
      out[o] = x;
      out[o + 1] = y * Math.sin(inc) + (s(i, 3) - 0.5) * 0.08;
      out[o + 2] = y * Math.cos(inc);
    };
    const helix: FormationFn = (i, t, out, o) => {
      const sel = s(i, 0);
      const x = s(i, 1) * 22 - 11;
      const th = x * 1.1 - t * 1.6;
      if (sel < 0.55) {
        const rr = 2.4 + (s(i, 2) - 0.5) * 0.12;
        out[o] = x;
        out[o + 1] = rr * Math.sin(th);
        out[o + 2] = rr * Math.cos(th);
      } else if (sel < 0.8) {
        // shadow on the floor: the real part, cos θ
        out[o] = x;
        out[o + 1] = -4.2;
        out[o + 2] = 2.4 * Math.cos(th);
      } else {
        // shadow on the back wall: the imaginary part, sin θ
        out[o] = x;
        out[o + 1] = 2.4 * Math.sin(th);
        out[o + 2] = -4.2;
      }
    };
    const galaxy: FormationFn = (i, t, out, o) => {
      const sel = s(i, 0);
      if (sel < 0.06) {
        // 17 bright clusters on the spiral
        const k = Math.floor(s(i, 1) * 17);
        const ang = k * 0.74 + t * 0.03;
        const r = 3 + k * 0.62;
        const jitter = 0.25;
        out[o] = r * Math.cos(ang) + (s(i, 2) - 0.5) * jitter;
        out[o + 1] = (s(i, 3) - 0.5) * jitter;
        out[o + 2] = r * Math.sin(ang) + (s(i, 1) * 7 % 1 - 0.5) * jitter;
        return;
      }
      const arm = sel < 0.53 ? 0 : 1;
      const r = 1 + Math.pow(s(i, 1), 0.7) * 16;
      const ang = arm * Math.PI + r * 0.36 + (s(i, 2) - 0.5) * (0.9 + 2.2 / r) + t * 0.03;
      out[o] = r * Math.cos(ang);
      out[o + 1] = (s(i, 3) - 0.5) * (1.4 - r * 0.05) * 1.2;
      out[o + 2] = r * Math.sin(ang);
    };
    const formations = [dust, tri, wave, orbit, helix, galaxy];
    const colorOf = (f: number, i: number, out: Float32Array, o: number) => {
      const p = palettes[f];
      let c = p[Math.floor(s(i, 2) * p.length) % p.length];
      if (f === 1) {
        const sel = s(i, 0);
        const k = (sel - 0.12) / 0.88;
        c = sel < 0.12 ? [1, 1, 1] : k < 9 / 50 ? p[0] : k < 25 / 50 ? p[1] : p[2];
      }
      const bright = (f === 0 ? 0.25 : f === 5 ? 0.42 : 0.5) + s(i, 3) * (f === 0 ? 0.35 : 0.55);
      out[o] = c[0] * bright;
      out[o + 1] = c[1] * bright;
      out[o + 2] = c[2] * bright;
    };

    const tmpA = new Float32Array(3);
    const tmpB = new Float32Array(3);
    const cA = new Float32Array(3);
    const cB = new Float32Array(3);
    const t0 = performance.now() - (startAtEnd.current ? (TIMES[5] + MORPH + 0.1) * 1000 : 0);
    let lastStage = -1;
    let raf = 0;
    let first = true;
    const tilt = new THREE.Euler();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = (performance.now() - t0) / 1000;
      let f = 0;
      for (let k = 0; k < TIMES.length; k++) if (t >= TIMES[k]) f = k;
      if (f !== lastStage) {
        lastStage = f;
        setStage(f);
      }
      const prev = Math.max(0, f - 1);
      const local = (t - TIMES[f]) / MORPH;
      for (let i = 0; i < N; i++) {
        const delay = s(i, 3) * 0.4;
        const m = f === 0 ? 1 : smoothstep((local - delay) / 0.6);
        formations[f](i, t, tmpB, 0);
        colorOf(f, i, cB, 0);
        if (m < 1) {
          formations[prev](i, t, tmpA, 0);
          colorOf(prev, i, cA, 0);
          // arc through space while morphing
          const lift = Math.sin(m * Math.PI) * (s(i, 1) - 0.5) * 3;
          pos[i * 3] = tmpA[0] + (tmpB[0] - tmpA[0]) * m;
          pos[i * 3 + 1] = tmpA[1] + (tmpB[1] - tmpA[1]) * m + lift;
          pos[i * 3 + 2] = tmpA[2] + (tmpB[2] - tmpA[2]) * m;
          col[i * 3] = cA[0] + (cB[0] - cA[0]) * m;
          col[i * 3 + 1] = cA[1] + (cB[1] - cA[1]) * m;
          col[i * 3 + 2] = cA[2] + (cB[2] - cA[2]) * m;
        } else {
          pos[i * 3] = tmpB[0];
          pos[i * 3 + 1] = tmpB[1];
          pos[i * 3 + 2] = tmpB[2];
          col[i * 3] = cB[0];
          col[i * 3 + 1] = cB[1];
          col[i * 3 + 2] = cB[2];
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      mat.uniforms.uFade.value = Math.min(1, startAtEnd.current ? 1 : t / 1.2);
      // camera choreography
      const camT = Math.min(t, 30);
      const view = [
        [0, 0, 24, 0.0],
        [0, 0.5, 15, 0.0],
        [0, 7, 17, 0.42],
        [0, 6, 21, 0.3],
        [6, 2, 15, 0.1],
        [0, 11, 21, 0.5],
      ][f];
      const pv = [
        [0, 0, 24, 0],
        [0, 0.5, 15, 0],
        [0, 7, 17, 0.42],
        [0, 6, 21, 0.3],
        [6, 2, 15, 0.1],
        [0, 11, 21, 0.5],
      ][prev];
      const cm = f === 0 ? 1 : smoothstep(local / 1.1);
      const cx = pv[0] + (view[0] - pv[0]) * cm + Math.sin(camT * 0.21) * 1.2;
      const cy = pv[1] + (view[1] - pv[1]) * cm;
      const cz = pv[2] + (view[2] - pv[2]) * cm;
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, f === 5 ? -1.5 : 0, 0);
      tilt.set(0, f === 5 ? t * 0.02 : 0, 0);
      points.rotation.copy(tilt);
      renderer.render(scene, camera);
      if (first) {
        first = false;
        setReady(true);
      }
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [low]);

  const enter = () => {
    audio.start();
    audio.swell();
    actions.markIntroSeen();
    setLeaving(true);
    window.setTimeout(() => navigate({ name: 'universe' }), reduced ? 50 : 650);
  };
  const skip = () => {
    actions.markIntroSeen();
    navigate({ name: 'universe' });
  };

  const showTitle = stage >= 5;
  const caption = CAPTIONS[stage];

  return (
    <div className={`intro ${ready ? 'is-ready' : ''} ${leaving ? 'is-leaving' : ''} ${webgl ? '' : 'no-webgl'}`}>
      <div className="intro-gl" ref={mountRef} aria-hidden />
      <div className="intro-vignette" aria-hidden />
      {caption && (
        <div className="intro-caption" key={stage} aria-hidden>
          <Tex tex={caption} display />
        </div>
      )}
      <div className={`intro-title ${showTitle ? 'show' : ''}`}>
        <div className="intro-kicker">An interactive expedition through mathematics</div>
        <h1>
          <span className="it-line">17 Equations</span>
          <span className="it-line it-em">That Changed the World</span>
        </h1>
        <p className="intro-sub">The mathematics behind everything.</p>
        <p className="intro-copy">From the shape of space to the structure of reality, discover the equations that made our world possible.</p>
        <button type="button" className="enter-btn" onClick={enter} disabled={!showTitle} tabIndex={showTitle ? 0 : -1}>
          <span className="enter-ring" aria-hidden />
          <span className="enter-label">Enter the universe</span>
        </button>
        <p className="intro-note">Sound will start softly — mute any time with M.</p>
      </div>
      {!showTitle && (
        <button type="button" className="skip-btn" onClick={skip}>
          Skip intro →
        </button>
      )}
    </div>
  );
}
