/**
 * Polyhedra as vertex lists + polygonal faces (counter-clockwise seen from outside).
 * Edges are derived from faces, so V, E, F are always counted from the actual structure.
 */
export type Vec3 = [number, number, number];

export interface Polyhedron {
  name: string;
  vertices: Vec3[];
  faces: number[][];
  genus?: number; // 0 for sphere-like surfaces
}

export function edgesOf(faces: number[][]): [number, number][] {
  const set = new Map<string, [number, number]>();
  for (const f of faces)
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!set.has(key)) set.set(key, a < b ? [a, b] : [b, a]);
    }
  return [...set.values()];
}

export function eulerCharacteristic(p: Polyhedron) {
  const V = p.vertices.length;
  const E = edgesOf(p.faces).length;
  const F = p.faces.length;
  return { V, E, F, chi: V - E + F };
}

const PHI = (1 + Math.sqrt(5)) / 2;

function normalizeRadius(vs: Vec3[], radius = 1): Vec3[] {
  const r = Math.max(...vs.map((v) => Math.hypot(...v)));
  return vs.map((v) => [(v[0] / r) * radius, (v[1] / r) * radius, (v[2] / r) * radius]);
}

/** Orient every face counter-clockwise when viewed from outside (polyhedron is star-shaped about origin). */
function orientFaces(vs: Vec3[], faces: number[][]): number[][] {
  return faces.map((f) => {
    const c = centroid(vs, f);
    const a = vs[f[0]];
    const b = vs[f[1]];
    const d = vs[f[2]];
    const n = cross(sub(b, a), sub(d, a));
    return dot(n, c) < 0 ? [...f].reverse() : f;
  });
}

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function centroid(vs: Vec3[], f: number[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const i of f) {
    c[0] += vs[i][0];
    c[1] += vs[i][1];
    c[2] += vs[i][2];
  }
  return [c[0] / f.length, c[1] / f.length, c[2] / f.length];
}

/** Build faces for a convex vertex set whose faces are all regular polygons of given edge length. */
function facesFromEdgeLength(vs: Vec3[], edge: number, sides: number): number[][] {
  // find edges
  const n = vs.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(Math.hypot(...sub(vs[i], vs[j])) - edge) < 1e-6 * Math.max(1, edge)) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  const faces = new Map<string, number[]>();
  // search cycles of length `sides` that are planar
  const dfs = (path: number[]) => {
    if (path.length === sides) {
      if (adj[path[sides - 1]].includes(path[0])) {
        const key = [...path].sort((a, b) => a - b).join(',');
        if (!faces.has(key) && isPlanar(vs, path)) faces.set(key, [...path]);
      }
      return;
    }
    for (const nb of adj[path[path.length - 1]]) {
      if (path.includes(nb) || nb < path[0]) continue;
      path.push(nb);
      if (isPlanar(vs, path)) dfs(path);
      path.pop();
    }
  };
  for (let i = 0; i < n; i++) dfs([i]);
  return orientFaces(vs, [...faces.values()]);
}

function isPlanar(vs: Vec3[], idx: number[]): boolean {
  if (idx.length < 4) return true;
  const a = vs[idx[0]];
  const nrm = cross(sub(vs[idx[1]], a), sub(vs[idx[2]], a));
  const len = Math.hypot(...nrm);
  if (len < 1e-9) return false;
  for (let k = 3; k < idx.length; k++) if (Math.abs(dot(nrm, sub(vs[idx[k]], a)) / len) > 1e-6) return false;
  return true;
}

export function tetrahedron(): Polyhedron {
  const v: Vec3[] = normalizeRadius([
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ]);
  return { name: 'Tetrahedron', vertices: v, faces: orientFaces(v, [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) };
}

export function cube(): Polyhedron {
  const v: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const vv = normalizeRadius(v);
  return { name: 'Cube', vertices: vv, faces: facesFromEdgeLength(vv, Math.hypot(...sub(vv[0], vv[1])), 4) };
}

export function octahedron(): Polyhedron {
  const v: Vec3[] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  return { name: 'Octahedron', vertices: v, faces: facesFromEdgeLength(v, Math.SQRT2, 3) };
}

export function icosahedron(): Polyhedron {
  const v: Vec3[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) {
    v.push([0, a, b]);
    v.push([a, b, 0]);
    v.push([b, 0, a]);
  }
  const vv = normalizeRadius(v);
  const edge = Math.hypot(...sub(vv[0], vv.reduce((best, w) => {
    const d = Math.hypot(...sub(vv[0], w));
    return d > 1e-9 && d < Math.hypot(...sub(vv[0], best)) ? w : best;
  }, [9, 9, 9] as Vec3)));
  return { name: 'Icosahedron', vertices: vv, faces: facesFromEdgeLength(vv, edge, 3) };
}

export function dodecahedron(): Polyhedron {
  const v: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    v.push([0, a / PHI, b * PHI]);
    v.push([a / PHI, b * PHI, 0]);
    v.push([b * PHI, 0, a / PHI]);
  }
  const vv = normalizeRadius(v);
  const edge = (2 / PHI) / Math.sqrt(3); // after normalisation radius √3 → 1
  return { name: 'Dodecahedron', vertices: vv, faces: facesFromEdgeLength(vv, edge, 5) };
}

export function prism(n: number): Polyhedron {
  const v: Vec3[] = [];
  const h = 0.75;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    v.push([Math.cos(a), h, Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    v.push([Math.cos(a), -h, Math.sin(a)]);
  }
  const faces: number[][] = [];
  faces.push([...Array(n).keys()]);
  faces.push([...Array(n).keys()].map((i) => n + i));
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
  const vv = normalizeRadius(v);
  return { name: `${n === 3 ? 'Triangular' : n === 5 ? 'Pentagonal' : n === 6 ? 'Hexagonal' : `${n}-gonal`} prism`, vertices: vv, faces: orientFaces(vv, faces) };
}

export function pyramid(n: number): Polyhedron {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    v.push([Math.cos(a), -0.6, Math.sin(a)]);
  }
  v.push([0, 1, 0]);
  const faces: number[][] = [[...Array(n).keys()]];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  // centre the solid so it is star-shaped about the origin
  const vv = normalizeRadius(v.map((p) => [p[0], p[1] - 0.1, p[2]] as Vec3));
  return { name: `${n === 4 ? 'Square' : n === 5 ? 'Pentagonal' : `${n}-gonal`} pyramid`, vertices: vv, faces: orientFaces(vv, faces) };
}

/** A polyhedral torus ("picture frame"): ring of n square cross-sections. V − E + F = 0. */
export function torus(n = 8, m = 4): Polyhedron {
  const R = 0.72;
  const r = 0.3;
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    for (let j = 0; j < m; j++) {
      const b = (2 * Math.PI * j) / m + Math.PI / 4;
      v.push([(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)]);
    }
  }
  const faces: number[][] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const a = i * m + j;
      const b = ((i + 1) % n) * m + j;
      const c = ((i + 1) % n) * m + ((j + 1) % m);
      const d = i * m + ((j + 1) % m);
      faces.push([a, d, c, b]);
    }
  return { name: 'Polyhedral torus', vertices: v, faces, genus: 1 };
}

export const SOLIDS: Record<string, () => Polyhedron> = {
  tetrahedron,
  cube,
  octahedron,
  dodecahedron,
  icosahedron,
  'triangular-prism': () => prism(3),
  'hexagonal-prism': () => prism(6),
  'square-pyramid': () => pyramid(4),
  torus: () => torus(),
};

/**
 * "Poke" a face: add a vertex just outside its centroid and join it to every corner.
 * ΔV = +1, ΔE = +k, ΔF = k − 1 ⇒ Δ(V − E + F) = 0.
 */
export function pokeFace(p: Polyhedron, faceIndex: number, lift = 0.12): Polyhedron {
  const f = p.faces[faceIndex];
  const c = centroid(p.vertices, f);
  const nrm = faceNormal(p.vertices, f);
  const len = 1;
  // edge-length-relative lift keeps small faces modest
  let perim = 0;
  for (let i = 0; i < f.length; i++) perim += Math.hypot(...sub(p.vertices[f[i]], p.vertices[f[(i + 1) % f.length]]));
  const h = lift * (perim / f.length);
  const apex: Vec3 = [c[0] + (nrm[0] / len) * h, c[1] + (nrm[1] / len) * h, c[2] + (nrm[2] / len) * h];
  const vertices = [...p.vertices, apex];
  const ai = vertices.length - 1;
  const newFaces = f.map((_, i) => [f[i], f[(i + 1) % f.length], ai]);
  const faces = [...p.faces.slice(0, faceIndex), ...newFaces, ...p.faces.slice(faceIndex + 1)];
  return { ...p, vertices, faces };
}

/**
 * Split an edge by inserting its midpoint into both adjacent faces.
 * ΔV = +1, ΔE = +1, ΔF = 0.
 */
export function splitEdge(p: Polyhedron, a: number, b: number): Polyhedron {
  const m: Vec3 = [
    (p.vertices[a][0] + p.vertices[b][0]) / 2,
    (p.vertices[a][1] + p.vertices[b][1]) / 2,
    (p.vertices[a][2] + p.vertices[b][2]) / 2,
  ];
  const vertices = [...p.vertices, m];
  const mi = vertices.length - 1;
  const faces = p.faces.map((f) => {
    const out: number[] = [];
    for (let i = 0; i < f.length; i++) {
      const x = f[i];
      const y = f[(i + 1) % f.length];
      out.push(x);
      if ((x === a && y === b) || (x === b && y === a)) out.push(mi);
    }
    return out;
  });
  return { ...p, vertices, faces };
}

/**
 * Cut a face along a diagonal into two faces (needs ≥ 4 corners).
 * ΔV = 0, ΔE = +1, ΔF = +1.
 */
export function splitFace(p: Polyhedron, faceIndex: number): Polyhedron | null {
  const f = p.faces[faceIndex];
  if (f.length < 4) return null;
  const half = Math.floor(f.length / 2);
  const f1 = f.slice(0, half + 1);
  const f2 = [...f.slice(half), f[0]];
  const faces = [...p.faces.slice(0, faceIndex), f1, f2, ...p.faces.slice(faceIndex + 1)];
  return { ...p, faces };
}

/**
 * Truncate (slice off) a vertex of degree d: the vertex is replaced by d new vertices on its edges.
 * ΔV = d − 1, ΔE = +d, ΔF = +1.
 */
export function truncateVertex(p: Polyhedron, vi: number, t = 0.28): Polyhedron {
  const vertices = [...p.vertices];
  const newIndex = new Map<number, number>(); // neighbour -> new vertex index
  const neighbours: number[] = [];
  for (const f of p.faces) {
    const k = f.indexOf(vi);
    if (k < 0) continue;
    for (const nb of [f[(k + 1) % f.length], f[(k - 1 + f.length) % f.length]])
      if (!neighbours.includes(nb)) neighbours.push(nb);
  }
  for (const nb of neighbours) {
    const a = p.vertices[vi];
    const b = p.vertices[nb];
    vertices.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    newIndex.set(nb, vertices.length - 1);
  }
  const faces = p.faces.map((f) => {
    const k = f.indexOf(vi);
    if (k < 0) return f;
    const prev = f[(k - 1 + f.length) % f.length];
    const next = f[(k + 1) % f.length];
    return [...f.slice(0, k), newIndex.get(prev)!, newIndex.get(next)!, ...f.slice(k + 1)];
  });
  // new face: order the new vertices by walking around the old vertex
  const ring: number[] = [];
  let cur = neighbours[0];
  for (let guard = 0; guard < neighbours.length; guard++) {
    ring.push(newIndex.get(cur)!);
    // find face where cur precedes... the face containing (vi -> cur) going around
    const face = p.faces.find((f) => {
      const k = f.indexOf(vi);
      return k >= 0 && f[(k + 1) % f.length] === cur;
    });
    if (!face) break;
    const k = face.indexOf(vi);
    // in this face, after vi comes cur; the vertex before vi is the next neighbour around (reverse orientation)
    cur = face[(k - 1 + face.length) % face.length];
    if (cur === neighbours[0]) break;
  }
  faces.push(ring);
  // remove old vertex: reindex
  const remap = (i: number) => (i > vi ? i - 1 : i);
  vertices.splice(vi, 1);
  return { ...p, vertices, faces: orientFaces2(vertices, faces.map((f) => f.map(remap))) };
}

/** Orientation fix using the solid's centroid (works for convex solids after local edits). */
function orientFaces2(vs: Vec3[], faces: number[][]): number[][] {
  const all = vs.map((_, i) => i);
  const g = centroid(vs, all);
  return faces.map((f) => {
    const c = centroid(vs, f);
    const n = faceNormal(vs, f);
    return dot(n, sub(c, g)) < 0 ? [...f].reverse() : f;
  });
}

/** Newell's method: robust polygon normal even when some corners are collinear. */
export function faceNormal(vs: Vec3[], f: number[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const a = vs[f[i]];
    const b = vs[f[(i + 1) % f.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}
