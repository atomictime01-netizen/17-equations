import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExperienceShell, useGoalWhen } from '../components/ExperienceShell';
import { Btn, Callout, ControlGroup, Icon, Segmented, Toggle } from '../components/Controls';
import { useLatest, useQualityLow, useReducedMotion } from '../core/hooks';
import { edgesOf, eulerCharacteristic, faceNormal, pokeFace, SOLIDS, splitEdge, splitFace, truncateVertex, type Polyhedron } from '../math/polyhedra';
import { mulberry32, smoothstep } from '../math/rng';

const SOLID_OPTIONS = [
  { value: 'tetrahedron', label: 'Tetrahedron' },
  { value: 'cube', label: 'Cube' },
  { value: 'octahedron', label: 'Octahedron' },
  { value: 'dodecahedron', label: 'Dodecahedron' },
  { value: 'icosahedron', label: 'Icosahedron' },
  { value: 'triangular-prism', label: 'Prism' },
  { value: 'square-pyramid', label: 'Pyramid' },
  { value: 'torus', label: 'Torus (genus 1)' },
];
const FACE_COLORS: Record<number, number> = { 3: 0x6ab7ff, 4: 0x9dff6a, 5: 0xffc861, 6: 0xff7ab6 };

export default function Polyhedra() {
  const reduced = useReducedMotion();
  const low = useQualityLow();
  const mountRef = useRef<HTMLDivElement>(null);
  const [solidId, setSolidId] = useState('cube');
  const [poly, setPoly] = useState<Polyhedron>(() => SOLIDS.cube());
  const [showV, setShowV] = useState(true);
  const [showE, setShowE] = useState(true);
  const [showF, setShowF] = useState(true);
  const [autoRotate, setAutoRotate] = useState(!reduced);
  const [surgeries, setSurgeries] = useState(0);
  const [lastOp, setLastOp] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(true);
  const rng = useRef(mulberry32(5));
  const counts = useMemo(() => eulerCharacteristic(poly), [poly]);
  const sceneRef = useRef<{ setPoly: (p: Polyhedron, fresh: boolean) => void; setVis: (v: boolean, e: boolean, f: boolean) => void; setAuto: (a: boolean) => void } | null>(null);
  const onFacePick = useLatest((fi: number) => applyOp('poke', fi));
  const polyRef = useLatest(poly);
  const lastBuilt = useRef<Polyhedron | null>(null);

  useGoalWhen('eu-ico', solidId === 'icosahedron');
  useGoalWhen('eu-surgery', surgeries >= 3 && counts.chi === 2);
  useGoalWhen('eu-torus', solidId === 'torus');

  useEffect(() => {
    const mount = mountRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(2.6, 1.6, 3.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 8;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.9;
    scene.add(new THREE.AmbientLight(0x8090ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x9dff6a, 6, 12);
    rim.position.set(-3, -2, -3);
    scene.add(rim);
    // starfield
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(1200 * 3);
    const r = mulberry32(3);
    for (let i = 0; i < 1200; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const R = 20 + r() * 20;
      sp[i * 3] = R * Math.sqrt(1 - u * u) * Math.cos(t);
      sp[i * 3 + 1] = R * u;
      sp[i * 3 + 2] = R * Math.sqrt(1 - u * u) * Math.sin(t);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb0ff, size: 0.06, transparent: true, opacity: 0.6 })));


    const group = new THREE.Group();
    scene.add(group);
    let vMesh: THREE.InstancedMesh | null = null;
    let eMesh: THREE.InstancedMesh | null = null;
    let vGlow: THREE.InstancedMesh | null = null;
    let eGlow: THREE.InstancedMesh | null = null;
    let faceMeshes: THREE.Mesh[] = [];
    let edgeData: { a: THREE.Vector3; b: THREE.Vector3; isNew: boolean }[] = [];
    let vertData: { p: THREE.Vector3; isNew: boolean }[] = [];
    let built = 0; // timestamp of build
    let prevVertKeys = new Set<string>();
    let prevEdgeKeys = new Set<string>();
    let prevFaceKeys = new Set<string>();
    let freshBuild = true;
    const vis = { v: true, e: true, f: true };
    const sphere = new THREE.SphereGeometry(0.045, 16, 12);
    const cyl = new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1);
    cyl.translate(0, 0.5, 0);
    const vMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff });
    // soft additive shells stand in for bloom without washing out the background
    const sphereGlow = new THREE.SphereGeometry(0.13, 16, 12);
    const cylGlow = new THREE.CylinderGeometry(0.05, 0.05, 1, 10, 1);
    cylGlow.translate(0, 0.5, 0);
    const glowMat = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const vGlowMat = glowMat(0x9fd8ff, 0.13);
    const eGlowMat = glowMat(0x6ab7ff, 0.1);
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const keyOf = (p: THREE.Vector3) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;

    const dispose = () => {
      if (vMesh) group.remove(vMesh);
      if (eMesh) group.remove(eMesh);
      if (vGlow) group.remove(vGlow);
      if (eGlow) group.remove(eGlow);
      vGlow?.dispose();
      eGlow?.dispose();
      for (const m of faceMeshes) {
        group.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      faceMeshes = [];
      vMesh?.dispose();
      eMesh?.dispose();
    };

    const build = (p: Polyhedron, fresh: boolean) => {
      dispose();
      freshBuild = fresh;
      const verts = p.vertices.map((v) => new THREE.Vector3(v[0], v[1], v[2]));
      const edges = edgesOf(p.faces);
      const vKeys = new Set(verts.map(keyOf));
      vertData = verts.map((v) => ({ p: v, isNew: !fresh && !prevVertKeys.has(keyOf(v)) }));
      edgeData = edges.map(([a, b]) => {
        const k1 = keyOf(verts[a]);
        const k2 = keyOf(verts[b]);
        const k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
        return { a: verts[a], b: verts[b], isNew: !fresh && !prevEdgeKeys.has(k), key: k };
      });
      const eKeys = new Set(edgeData.map((e) => (e as { key?: string }).key!));
      vMesh = new THREE.InstancedMesh(sphere, vMat, verts.length);
      eMesh = new THREE.InstancedMesh(cyl, eMat, edges.length);
      vMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(verts.length * 3), 3);
      eMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(edges.length * 3), 3);
      vertData.forEach((v, i) => vMesh!.setColorAt(i, new THREE.Color(v.isNew ? 0xffe46b : 0xffffff)));
      edgeData.forEach((e, i) => eMesh!.setColorAt(i, new THREE.Color(e.isNew ? 0xffe46b : 0xbfe0ff)));
      vGlow = new THREE.InstancedMesh(sphereGlow, vGlowMat, verts.length);
      eGlow = new THREE.InstancedMesh(cylGlow, eGlowMat, edges.length);
      group.add(vMesh, eMesh, vGlow, eGlow);
      const fKeys = new Set<string>();
      p.faces.forEach((f, fi) => {
        const pos: number[] = [];
        for (let k = 1; k < f.length - 1; k++) for (const idx of [f[0], f[k], f[k + 1]]) pos.push(...p.vertices[idx]);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        const fk = f.map((i) => keyOf(verts[i])).sort().join('#');
        fKeys.add(fk);
        const isNew = !fresh && !prevFaceKeys.has(fk);
        const col = FACE_COLORS[Math.min(6, f.length)] ?? 0xffffff;
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: isNew ? 0xffe46b : col,
          emissiveIntensity: isNew ? 0.6 : 0.18,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          roughness: 0.35,
          metalness: 0.1,
        });
        const mesh = new THREE.Mesh(g, mat);
        mesh.userData = { fi, isNew, order: fi / Math.max(1, p.faces.length - 1), normal: faceNormal(p.vertices, f) };
        faceMeshes.push(mesh);
        group.add(mesh);
      });
      prevVertKeys = vKeys;
      prevEdgeKeys = eKeys;
      prevFaceKeys = fKeys;
      built = performance.now();
      applyVis();
    };
    const applyVis = () => {
      if (vMesh) vMesh.visible = vis.v;
      if (eMesh) eMesh.visible = vis.e;
      if (vGlow) vGlow.visible = vis.v;
      if (eGlow) eGlow.visible = vis.e;
      faceMeshes.forEach((m) => (m.visible = vis.f));
    };

    sceneRef.current = {
      setPoly: build,
      setVis: (v, e, f) => {
        vis.v = v;
        vis.e = e;
        vis.f = f;
        applyVis();
      },
      setAuto: (a) => {
        controls.autoRotate = a;
      },
    };

    // click a face to poke it
    const ray = new THREE.Raycaster();
    let downAt: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (downAt = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(faceMeshes.filter((m) => m.visible))[0];
      if (hit) onFacePick.current(hit.object.userData.fi);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    build(polyRef.current, true);
    lastBuilt.current = polyRef.current;

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const t = (performance.now() - built) / 1000;
      const speed = reduced ? 50 : 1;
      // assembly choreography: vertices → edges → faces (only on a fresh solid)
      const tv = freshBuild ? t * speed : 10;
      if (vMesh) {
        vertData.forEach((v, i) => {
          const s = smoothstep((tv - (i / vertData.length) * 0.6) / 0.25) * (v.isNew ? 1 + 0.6 * Math.exp(-t * 3) : 1);
          tmpM.compose(v.p, tmpQ.identity(), new THREE.Vector3(s, s, s));
          vMesh!.setMatrixAt(i, tmpM);
          vGlow?.setMatrixAt(i, tmpM);
        });
        vMesh.instanceMatrix.needsUpdate = true;
        if (vGlow) vGlow.instanceMatrix.needsUpdate = true;
      }
      if (eMesh) {
        edgeData.forEach((e, i) => {
          const grow = freshBuild ? smoothstep((tv - 0.7 - (i / edgeData.length) * 0.9) / 0.35) : 1;
          const dir = new THREE.Vector3().subVectors(e.b, e.a);
          const len = dir.length();
          tmpQ.setFromUnitVectors(up, dir.normalize());
          const thick = e.isNew ? 1 + 0.8 * Math.exp(-t * 2.5) : 1;
          tmpM.compose(e.a, tmpQ, new THREE.Vector3(thick, Math.max(1e-4, len * grow), thick));
          eMesh!.setMatrixAt(i, tmpM);
          eGlow?.setMatrixAt(i, tmpM);
        });
        eMesh.instanceMatrix.needsUpdate = true;
        if (eGlow) eGlow.instanceMatrix.needsUpdate = true;
      }
      faceMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        const appear = freshBuild ? smoothstep((tv - 1.7 - m.userData.order * 1.6) / 0.3) : 1;
        const flash = freshBuild ? Math.exp(-Math.max(0, tv - 1.7 - m.userData.order * 1.6) * 4) : 0;
        mat.opacity = 0.32 * appear + 0.25 * flash;
        mat.emissiveIntensity = m.userData.isNew ? 0.2 + 0.8 * Math.exp(-t * 1.5) : 0.16 + flash * 0.9;
      });
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
      dispose();
      sphere.dispose();
      cyl.dispose();
      sphereGlow.dispose();
      cylGlow.dispose();
      vGlowMat.dispose();
      eGlowMat.dispose();
      vMat.dispose();
      eMat.dispose();
      starGeo.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [low, reduced, onFacePick, polyRef]);

  const freshRef = useRef(true);
  useEffect(() => {
    if (lastBuilt.current === poly) return;
    sceneRef.current?.setPoly(poly, freshRef.current);
    lastBuilt.current = poly;
    freshRef.current = false;
  }, [poly]);
  useEffect(() => {
    sceneRef.current?.setVis(showV, showE, showF);
  }, [showV, showE, showF]);
  useEffect(() => {
    sceneRef.current?.setAuto(autoRotate);
  }, [autoRotate]);

  const choose = (id: string) => {
    setSolidId(id);
    freshRef.current = true;
    setPoly(SOLIDS[id]());
    setSurgeries(0);
    setLastOp(null);
  };

  function applyOp(op: 'poke' | 'split' | 'cut' | 'truncate', faceIndex?: number) {
    const before = eulerCharacteristic(poly);
    let next: Polyhedron | null = null;
    const rnd = rng.current;
    if (op === 'poke') next = pokeFace(poly, faceIndex ?? Math.floor(rnd() * poly.faces.length), poly.genus ? 0.25 : 0.18);
    else if (op === 'split') {
      const edges = edgesOf(poly.faces);
      const [a, b] = edges[Math.floor(rnd() * edges.length)];
      next = splitEdge(poly, a, b);
    } else if (op === 'cut') {
      const cands = poly.faces.map((f, i) => [f.length, i]).filter(([l]) => l >= 4);
      if (!cands.length) return;
      next = splitFace(poly, cands[Math.floor(rnd() * cands.length)][1]);
    } else {
      next = truncateVertex(poly, Math.floor(rnd() * poly.vertices.length), 0.26);
    }
    if (!next) return;
    const after = eulerCharacteristic(next);
    setLastOp(`${opName(op)}: ΔV = ${signed(after.V - before.V)}, ΔE = ${signed(after.E - before.E)}, ΔF = ${signed(after.F - before.F)} → Δχ = ${signed(after.chi - before.chi)}`);
    freshRef.current = false;
    setPoly(next);
    setSurgeries((s) => s + 1);
  }

  const reset = () => choose(solidId);
  const canCut = poly.faces.some((f) => f.length >= 4);
  const isTorus = !!poly.genus;

  return (
    <ExperienceShell
      stage={
        <>
          <div ref={mountRef} className="fill" aria-label={`${poly.name}: drag to rotate, click a face to poke it`} />
          {!webgl && <div className="error-box">WebGL is not available, so the 3-D solid cannot be drawn. The counts below remain correct.</div>}
          <div className="euler-count" aria-live="polite">
            <span className={`ec v ${showV ? '' : 'off'}`}>
              <small>V</small>
              {counts.V}
            </span>
            <span className="ec-op">−</span>
            <span className={`ec e ${showE ? '' : 'off'}`}>
              <small>E</small>
              {counts.E}
            </span>
            <span className="ec-op">+</span>
            <span className={`ec f ${showF ? '' : 'off'}`}>
              <small>F</small>
              {counts.F}
            </span>
            <span className="ec-op">=</span>
            <span className={`ec chi ${counts.chi === 2 ? '' : 'odd'}`}>
              <small>χ</small>
              {counts.chi}
            </span>
          </div>
        </>
      }
      onReset={reset}
      toolbar={
        <Btn onClick={() => setAutoRotate((a) => !a)} icon={autoRotate ? Icon.pause : Icon.play}>
          {autoRotate ? 'Stop spin' : 'Spin'}
        </Btn>
      }
      legend={
        <>
          <span className="legend-item"><i className="legend-swatch" style={{ background: '#6ab7ff' }} /> triangles</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: '#9dff6a' }} /> quadrilaterals</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: '#ffc861' }} /> pentagons</span>
          <span className="legend-item"><i className="legend-swatch" style={{ background: '#ffe46b' }} /> just created</span>
        </>
      }
      notice={
        isTorus ? (
          <Callout tone="warn">
            A torus has a hole: <strong>V − E + F = 0</strong>, not 2. In general χ = 2 − 2g for a surface with g holes.
          </Callout>
        ) : lastOp ? (
          <Callout tone="event">{lastOp}</Callout>
        ) : undefined
      }
      controls={
        <>
          <Segmented label="Solid" value={solidId} onChange={choose} options={SOLID_OPTIONS} />
          <ControlGroup title="Show">
            <div className="toggle-row">
              <Toggle label={`Vertices (${counts.V})`} checked={showV} onChange={setShowV} />
              <Toggle label={`Edges (${counts.E})`} checked={showE} onChange={setShowE} />
              <Toggle label={`Faces (${counts.F})`} checked={showF} onChange={setShowF} />
            </div>
          </ControlGroup>
          <ControlGroup title="Topological surgery">
            <p className="responds" style={{ margin: 0 }}>Each operation changes V, E and F — watch what happens to V − E + F. Click any face to poke it directly.</p>
            <div className="btn-row">
              <Btn onClick={() => applyOp('poke')}>Poke a face</Btn>
              <Btn onClick={() => applyOp('split')}>Split an edge</Btn>
              <Btn onClick={() => applyOp('cut')} disabled={!canCut}>Cut a face</Btn>
              <Btn onClick={() => applyOp('truncate')} disabled={isTorus}>Slice a corner</Btn>
            </div>
          </ControlGroup>
        </>
      }
      readouts={
        <dl className="readouts" style={{ ['--cols' as string]: 2 }}>
          <div className="readout accent">
            <dt>V − E + F</dt>
            <dd>
              {counts.V} − {counts.E} + {counts.F} = {counts.chi}
            </dd>
          </div>
          <div className="readout">
            <dt>surgeries performed</dt>
            <dd>{surgeries}</dd>
          </div>
          <div className="readout">
            <dt>surface type</dt>
            <dd>{isTorus ? 'torus, genus 1' : 'sphere-like, genus 0'}</dd>
          </div>
          <div className="readout">
            <dt>2 − 2g</dt>
            <dd>{2 - 2 * (poly.genus ?? 0)}</dd>
          </div>
        </dl>
      }
    />
  );
}

function opName(op: string) {
  return op === 'poke' ? 'Poke face' : op === 'split' ? 'Split edge' : op === 'cut' ? 'Cut face' : 'Slice corner';
}
function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}
