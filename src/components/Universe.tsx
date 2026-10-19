import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildEarthTextures } from './earthTextures';
import { allConnections, EQ_BY_ID, EQUATIONS, type Equation } from '../data/equations';
import { useStore } from '../core/store';
import { audio } from '../core/audio';
import { useIsMobile, useReducedMotion } from '../core/hooks';
import { mulberry32 } from '../math/rng';
import { Rich, Tex } from './Tex';
import { Icon, Segmented } from './Controls';
import { Glyph } from './Glyph';

export function Universe({ onEnter }: { onEnter: (id: string, x?: number, y?: number) => void }) {
  const mobile = useIsMobile();
  const reduced = useReducedMotion();
  const [view, setView] = useState<'map' | 'list'>(mobile ? 'list' : 'map');
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(true);
  const [activeLink, setActiveLink] = useState<{ a: string; b: string; why: string } | null>(null);
  const visited = useStore((s) => s.visited);
  const completed = useStore((s) => s.completed);
  const favs = useStore((s) => s.favourites);

  useEffect(() => setView(mobile ? 'list' : 'map'), [mobile]);

  const focusId = hover ?? selected;
  const focusEq = focusId ? EQ_BY_ID[focusId] : null;
  const doneOf = (e: Equation) => e.challenges.filter((c) => completed[c.id]).length;
  const visitedCount = Object.keys(visited).length;

  const head = (
    <header className={`uni-head ${view === 'list' ? 'in-flow' : ''}`}>
      <div className="uni-kicker">The universe of equations</div>
      <h1 className="uni-title">
        Seventeen ideas, <em>one expedition</em>
      </h1>
      <p className="uni-copy">
        Each point of light is a laboratory. {view === 'map' ? 'Drag to turn the Earth, scroll to zoom, select an equation to enter.' : 'Choose an equation to enter.'}
      </p>
      <div className="uni-progress">
        <span>
          <b>{visitedCount}</b>/17 explored
        </span>
        <span>
          <b>{Object.keys(completed).length}</b> experiments done
        </span>
      </div>
    </header>
  );

  return (
    <div className="universe">
      {view === 'map' ? (
        <Constellation
          hover={hover}
          setHover={setHover}
          selected={selected}
          setSelected={setSelected}
          showLinks={showLinks}
          onEnter={onEnter}
          reduced={reduced}
          visited={visited}
          favs={favs}
          doneOf={doneOf}
          setActiveLink={setActiveLink}
        />
      ) : (
        <ListView onEnter={onEnter} visited={visited} doneOf={doneOf} favs={favs} head={head} />
      )}

      {view === 'map' && head}

      <div className="uni-tools">
        <Segmented
          small
          value={view}
          onChange={setView}
          options={[
            { value: 'map', label: 'Globe' },
            { value: 'list', label: 'List' },
          ]}
        />
        {view === 'map' && (
          <button type="button" className={`chip ${showLinks ? 'on' : ''}`} onClick={() => setShowLinks((s) => !s)} aria-pressed={showLinks}>
            Relationship map
          </button>
        )}
      </div>

      {view === 'map' && activeLink && !focusEq && (
        <div className="uni-link-card">
          <div className="ulc-pair">
            <span style={{ color: EQ_BY_ID[activeLink.a].palette.a }}>{EQ_BY_ID[activeLink.a].name}</span>
            <span className="ulc-dash" />
            <span style={{ color: EQ_BY_ID[activeLink.b].palette.a }}>{EQ_BY_ID[activeLink.b].name}</span>
          </div>
          <p>
            <Rich text={activeLink.why} />
          </p>
        </div>
      )}

      {view === 'map' && focusEq && (
        <aside className="uni-card" style={{ ['--a' as string]: focusEq.palette.a, ['--b' as string]: focusEq.palette.b }} aria-live="polite">
          <div className="uc-num">
            {String(focusEq.num).padStart(2, '0')} · {focusEq.era}
          </div>
          <h2 className="uc-name">{focusEq.name}</h2>
          <div className="uc-eq">
            <Tex tex={focusEq.tex} display />
          </div>
          <p className="uc-short">{focusEq.short}</p>
          <div className="uc-links">
            {focusEq.connections.map((c) => (
              <span key={c.to} className="uc-link" style={{ ['--la' as string]: EQ_BY_ID[c.to].palette.a }}>
                {EQ_BY_ID[c.to].name}
              </span>
            ))}
          </div>
          <div className="uc-foot">
            <span className="uc-prog">
              {doneOf(focusEq)}/{focusEq.challenges.length} experiments
            </span>
            <button type="button" className="btn btn-primary" onClick={() => onEnter(focusEq.id, window.innerWidth / 2, window.innerHeight / 2)}>
              Enter {Icon.next}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

function Constellation(props: {
  hover: string | null;
  setHover: (id: string | null) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  showLinks: boolean;
  onEnter: (id: string, x?: number, y?: number) => void;
  reduced: boolean;
  visited: Record<string, number>;
  favs: string[];
  doneOf: (e: Equation) => number;
  setActiveLink: (l: { a: string; b: string; why: string } | null) => void;
}) {
  const { hover, setHover, selected, setSelected, showLinks, onEnter, reduced, visited, favs, doneOf, setActiveLink } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const links = useMemo(allConnections, []);
  const stateRef = useRef({ hover, selected, showLinks });
  stateRef.current = { hover, selected, showLinks };
  const linkHit = useRef<{ a: string; b: string; why: string; x: number; y: number }[]>([]);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const mount = glRef.current!;
    const overlay = overlayRef.current!;
    const octx = overlay.getContext('2d')!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebgl(false);
      return;
    }
    const N = EQUATIONS.length;
    let w = wrap.clientWidth;
    let h = wrap.clientHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 200);
    // default framing sits a little closer than a full overview
    // fixed camera; dragging turns the globe itself (so the ring of equations never goes edge-on)
    const camDirBase = new THREE.Vector3(0, 1.25, 5.6).normalize();
    let camDistance = 5.6;
    let camTarget = 5.6;
    const placeCamera = () => {
      camera.position.copy(camDirBase).multiplyScalar(camDistance);
      camera.lookAt(0, 0, 0);
    };
    placeCamera();

    // default framing: as close as possible while the ring and its labels stay on screen
    const RING_R = 1.72;
    /*const fitDistance = () => {
      const tanHalf = Math.tan(((camera.fov / 2) * Math.PI) / 180);
      const shiftPx = w > 900 ? w * 0.05 : 0;
      const narrow = w < 560;
      const labelRoom = narrow ? 30 : w < 700 ? 110 : 190;
      const avail = Math.max(120, w / 2 - shiftPx - labelRoom);
      const dW = (RING_R * h) / (2 * tanHalf * avail);
      const dH = 1.5 / tanHalf;
      return Math.min(narrow ? 14 : 8.5, Math.max(4.4, dW, dH));
    };*/

    const fitDistance = () => {
      const tanHalf = Math.tan(((camera.fov / 2) * Math.PI) / 180);
      const shiftPx = w > 900 ? w * 0.05 : 0;
      const narrow = w < 560;
      const labelRoom = narrow ? 30 : w < 700 ? 110 : 190;
      const avail = Math.max(120, w / 2 - shiftPx - labelRoom);

      const dW = (RING_R * h) / (2 * tanHalf * avail);
      const dH = 1.5 / tanHalf;

      // Start farther away to show the entire constellation.
      return Math.max(6.0, dW, dH);
      //return Math.min(narrow ? 14 : 6.0, Math.max(4.4, dW, dH));

    };
    // re-fit on resize until the visitor zooms by hand
    let userZoomed = false;
    const onWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      userZoomed = true;
      //camTarget = Math.min(14, Math.max(3.2, camTarget * Math.exp(e.deltaY * 0.0011)));
      camTarget = Math.min(18, Math.max(3.2, camTarget * Math.exp(e.deltaY * 0.0011)));
    };
    wrap.addEventListener('wheel', onWheelZoom, { passive: false });
    // shift the globe right on wide screens so it clears the title block
    const frame = () => {
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      renderer.setSize(w, h);
      overlay.width = Math.round(w * dpr);
      overlay.height = Math.round(h * dpr);
      camera.aspect = w / h;
      const shift = w > 900 ? -w * 0.05 : 0;
      camera.setViewOffset(w, h, shift, w > 900 ? 0 : -h * 0.04, w, h);
      camera.updateProjectionMatrix();
      if (!userZoomed) {
        camTarget = camDistance = fitDistance();
        placeCamera();
      }
    };
    frame();

    // sun and fill light
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(-5, 2.2, 3.5);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x3a4a7a, 0.35));

    // stars
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(2400 * 3);
    const sc = new Float32Array(2400 * 3);
    const r = mulberry32(9);
    for (let i = 0; i < 2400; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const R = 40 + r() * 40;
      sp[i * 3] = R * Math.sqrt(1 - u * u) * Math.cos(t);
      sp[i * 3 + 1] = R * u;
      sp[i * 3 + 2] = R * Math.sqrt(1 - u * u) * Math.sin(t);
      const warm = r() > 0.85;
      sc[i * 3] = warm ? 1 : 0.75;
      sc[i * 3 + 1] = warm ? 0.85 : 0.82;
      sc[i * 3 + 2] = warm ? 0.7 : 1;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true }));
    scene.add(stars);

    // the Earth: tilted 23.4° on its axis
    const holder = new THREE.Group(); // receives the drag rotation
    scene.add(holder);
    const dragState = { down: false, x: 0, y: 0, t: 0, vx: 0, vy: 0 };
    const qTmp = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);
    /** Rotate the globe about screen-aligned axes (world Y for horizontal drags, camera-right for vertical). */
    const spinHolder = (ax: number, ay: number) => {
      if (ax) holder.quaternion.premultiply(qTmp.setFromAxisAngle(yAxis, ax));
      if (ay) holder.quaternion.premultiply(qTmp.setFromAxisAngle(xAxis, ay));
    };
    const tilt = new THREE.Group();
    tilt.rotation.z = (23.4 * Math.PI) / 180;
    holder.add(tilt);
    const earthGeo = new THREE.SphereGeometry(1, 96, 64);
    const earthMat = new THREE.MeshPhongMaterial({ color: 0x0b2a4a, shininess: 22, specular: new THREE.Color(0x335577), emissive: new THREE.Color(0xffffff), emissiveIntensity: 0 });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.y = -1.9;
    tilt.add(earth);
    const cloudMat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 72, 48), cloudMat);
    tilt.add(clouds);
    // atmosphere: fresnel rim, additive, drawn from the back faces
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.09, 64, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
            gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * f * 1.6, f);
          }`,
      }),
    );
    scene.add(atmo);

    // textures are generated from bundled geography after the first frame
    let disposed = false;
    const texList: THREE.Texture[] = [];
    buildEarthTextures(w < 700 ? 1024 : 2048)
      .then((t) => {
        if (disposed) return;
        const mk = (c: HTMLCanvasElement, srgb = true) => {
          const tex = new THREE.CanvasTexture(c);
          if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          texList.push(tex);
          return tex;
        };
        earthMat.map = mk(t.day);
        earthMat.color.set(0xffffff);
        earthMat.specularMap = mk(t.spec, false);
        earthMat.emissiveMap = mk(t.glow);
        earthMat.emissiveIntensity = 0.55;
        earthMat.needsUpdate = true;
        cloudMat.map = mk(t.clouds);
        cloudMat.opacity = 0.9;
        cloudMat.needsUpdate = true;
      })
      .catch(() => {
        // no geography: keep the plain ocean-coloured sphere
      });

    // the equations orbit as a tilted ring of satellites
    const RING = RING_R;
    const ringTilt = new THREE.Euler(0.38, 0, -0.12);
    const ringQ = new THREE.Quaternion().setFromEuler(ringTilt);
    const orbitLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(RING * Math.cos((k / 160) * 2 * Math.PI), 0, RING * Math.sin((k / 160) * 2 * Math.PI)).applyQuaternion(ringQ))),
      new THREE.LineBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.28 }),
    );
    scene.add(orbitLine);

    let phase = 0;
    const tmp = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const toNode = new THREE.Vector3();
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      const { hover: hv, selected: sel, showLinks: sl } = stateRef.current;
      if (!reduced) {
        earth.rotation.y += dt * 0.05;
        clouds.rotation.y += dt * 0.065;
        if (!hv) phase += dt * 0.07;
      }
      // trackball spin with inertia, plus smooth zoom
      if (!dragState.down) {
        dragState.vx *= Math.pow(0.04, dt);
        dragState.vy *= Math.pow(0.04, dt);
        spinHolder(dragState.vx * dt, dragState.vy * dt);
      }
      if (Math.abs(camTarget - camDistance) > 1e-4) {
        camDistance += (camTarget - camDistance) * Math.min(1, dt * 8);
        placeCamera();
      }
      renderer.render(scene, camera);

      // project the satellites to screen and position the DOM buttons
      const pts: { x: number; y: number; behind: boolean; depth: number }[] = [];
      camDir.copy(camera.position);
      const camDist = camDir.length();
      for (let i = 0; i < N; i++) {
        const a = phase + (2 * Math.PI * i) / N;
        tmp.set(RING * Math.cos(a), 0, RING * Math.sin(a)).applyQuaternion(ringQ);
        // occluded by the Earth? (ray from camera to node passes within the unit sphere first)
        toNode.copy(tmp).sub(camera.position);
        const len = toNode.length();
        toNode.divideScalar(len);
        const b = camera.position.dot(toNode);
        const c = camera.position.lengthSq() - 1;
        const disc = b * b - c;
        const hitT = disc > 0 ? -b - Math.sqrt(disc) : Infinity;
        const behind = hitT > 0 && hitT < len;
        const depth = tmp.distanceTo(camera.position) / camDist;
        tmp.project(camera);
        pts.push({ x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, behind, depth });
      }
      pts.forEach((p, i) => {
        const el = nodeRefs.current[i];
        if (!el) return;
        const s = Math.max(0.72, Math.min(1.12, 1.25 - (p.depth - 1) * 1.3));
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`;
        el.style.zIndex = String(Math.round(1000 - p.depth * 300));
        el.style.opacity = p.behind ? '0.28' : '1';
        const side = p.x < w / 2 + (w > 900 ? w * 0.05 : 0) ? 'l' : 'r';
        if (el.dataset.side !== side) el.dataset.side = side;
      });

      // relationship arcs, drawn in screen space between the satellites
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      const focus = hv ?? sel;
      linkHit.current = [];
      const cx = w / 2 + (w > 900 ? w * 0.05 : 0);
      const cy = h / 2 + (w > 900 ? 0 : h * 0.04);
      for (const l of links) {
        const ia = EQUATIONS.findIndex((e) => e.id === l.a);
        const ib = EQUATIONS.findIndex((e) => e.id === l.b);
        const pa = pts[ia];
        const pb = pts[ib];
        const involved = focus && (l.a === focus || l.b === focus);
        if (!sl && !involved) continue;
        const alpha = involved ? 0.9 : focus ? 0.03 : pa.behind || pb.behind ? 0.05 : 0.13;
        // bow arcs outward, away from the globe, like flight paths
        const mx0 = (pa.x + pb.x) / 2;
        const my0 = (pa.y + pb.y) / 2;
        const mx = mx0 + (mx0 - cx) * 0.35;
        const my = my0 + (my0 - cy) * 0.35 - Math.hypot(pa.x - pb.x, pa.y - pb.y) * 0.12;
        const grad = octx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        grad.addColorStop(0, hexA(EQ_BY_ID[l.a].palette.a, alpha));
        grad.addColorStop(1, hexA(EQ_BY_ID[l.b].palette.a, alpha));
        octx.strokeStyle = grad;
        octx.lineWidth = involved ? 1.8 : 1;
        octx.beginPath();
        octx.moveTo(pa.x, pa.y);
        octx.quadraticCurveTo(mx, my, pb.x, pb.y);
        octx.stroke();
        if (involved && !reduced) {
          const u = (t * 0.5) % 1;
          const qx = (1 - u) * (1 - u) * pa.x + 2 * (1 - u) * u * mx + u * u * pb.x;
          const qy = (1 - u) * (1 - u) * pa.y + 2 * (1 - u) * u * my + u * u * pb.y;
          octx.fillStyle = 'rgba(255,255,255,0.95)';
          octx.beginPath();
          octx.arc(qx, qy, 2.2, 0, Math.PI * 2);
          octx.fill();
        }
        linkHit.current.push({ ...l, x: 0.25 * pa.x + 0.5 * mx + 0.25 * pb.x, y: 0.25 * pa.y + 0.5 * my + 0.25 * pb.y });
      }
    };
    raf = requestAnimationFrame(loop);

    // link hover cards; a click on empty space clears the selection
    let downAt: [number, number] | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let best: (typeof linkHit.current)[number] | null = null;
      let bd = 18;
      for (const l of linkHit.current) {
        const d = Math.hypot(l.x - x, l.y - y);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      setActiveLink(best ? { a: best.a, b: best.b, why: best.why } : null);
    };
    const onDown = (e: PointerEvent) => {
      downAt = [e.clientX, e.clientY];
      dragState.down = true;
      dragState.x = e.clientX;
      dragState.y = e.clientY;
      dragState.t = performance.now();
      dragState.vx = dragState.vy = 0;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onDrag = (e: PointerEvent) => {
      if (!dragState.down) return;
      const now = performance.now();
      const dx = (e.clientX - dragState.x) * 0.006;
      const dy = (e.clientY - dragState.y) * 0.006;
      spinHolder(dx, dy);
      const el = Math.max(0.008, (now - dragState.t) / 1000);
      dragState.vx = dx / el;
      dragState.vy = dy / el;
      dragState.x = e.clientX;
      dragState.y = e.clientY;
      dragState.t = now;
    };
    const onUp = (e: PointerEvent) => {
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4) setSelected(null);
      downAt = null;
      dragState.down = false;
      if (performance.now() - dragState.t > 90) dragState.vx = dragState.vy = 0;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onDrag);
    renderer.domElement.addEventListener('pointerup', onUp);
    const ro = new ResizeObserver(frame);
    ro.observe(wrap);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onDrag);
      renderer.domElement.removeEventListener('pointerup', onUp);
      wrap.removeEventListener('wheel', onWheelZoom);
      texList.forEach((t) => t.dispose());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [links, reduced, setSelected, setActiveLink]);

  return (
    <div className="constellation globe" ref={wrapRef}>
      <div ref={glRef} className="uni-gl" aria-label="Rotating Earth: drag to turn it, scroll to zoom" />
      <canvas ref={overlayRef} className="uni-canvas uni-overlay" aria-hidden />
      {!webgl && <div className="error-box">WebGL is unavailable here — switch to the List view to choose an equation.</div>}
      <ol className="uni-nodes" aria-label="Equations">
        {EQUATIONS.map((e, i) => {
          const done = doneOf(e);
          const total = e.challenges.length;
          const isFocus = hover === e.id || selected === e.id;
          return (
            <li key={e.id}>
              <button
                ref={(el) => (nodeRefs.current[i] = el)}
                type="button"
                className={`uni-node ${visited[e.id] ? 'visited' : ''} ${done === total ? 'complete' : ''} ${isFocus ? 'focus' : ''}`}
                style={{ ['--a' as string]: e.palette.a, ['--b' as string]: e.palette.b, ['--prog' as string]: done / total }}
                onPointerEnter={(ev) => ev.pointerType === 'mouse' && setHover(e.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setSelected(e.id)}
                onClick={(ev) => {
                  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                  if ((ev.nativeEvent as PointerEvent).pointerType === 'touch' && selected !== e.id) {
                    setSelected(e.id);
                    audio.click();
                    return;
                  }
                  onEnter(e.id, r.left + r.width / 2, r.top + r.height / 2);
                }}
                aria-label={`${e.num}. ${e.name}. ${e.short}. ${done} of ${total} experiments complete.`}
              >
                <span className="un-orb">
                  <svg viewBox="0 0 64 64" className="un-ring" aria-hidden>
                    <circle cx="32" cy="32" r="29" className="un-ring-bg" />
                    <circle cx="32" cy="32" r="29" className="un-ring-fg" pathLength={1} style={{ strokeDasharray: `${done / total} 1` }} />
                  </svg>
                  <Glyph kind={e.glyph} />
                </span>
                <span className="un-label">
                  <span className="un-num">{String(e.num).padStart(2, '0')}</span>
                  <span className="un-name">{e.name}</span>
                  {favs.includes(e.id) && <span className="un-star">★</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ListView({
  onEnter,
  visited,
  doneOf,
  favs,
  head,
}: {
  onEnter: (id: string, x?: number, y?: number) => void;
  visited: Record<string, number>;
  doneOf: (e: Equation) => number;
  favs: string[];
  head: React.ReactNode;
}) {
  return (
    <div className="uni-list-wrap">
      {head}
      <ol className="uni-list">
        {EQUATIONS.map((e) => {
          const done = doneOf(e);
          return (
            <li key={e.id}>
              <button
                type="button"
                className="ul-item"
                style={{ ['--a' as string]: e.palette.a, ['--b' as string]: e.palette.b }}
                onClick={(ev) => {
                  const r = ev.currentTarget.getBoundingClientRect();
                  onEnter(e.id, r.left + 40, r.top + r.height / 2);
                }}
              >
                <span className="ul-glyph">
                  <Glyph kind={e.glyph} />
                </span>
                <span className="ul-text">
                  <span className="ul-num">
                    {String(e.num).padStart(2, '0')} · {e.era} {favs.includes(e.id) && <b className="un-star">★</b>}
                  </span>
                  <span className="ul-name">{e.name}</span>
                  <span className="ul-eq">
                    <Tex tex={e.tex} />
                  </span>
                </span>
                <span className="ul-meta">
                  <span className={`ul-badge ${visited[e.id] ? 'v' : ''}`}>{visited[e.id] ? `${done}/${e.challenges.length}` : 'New'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
