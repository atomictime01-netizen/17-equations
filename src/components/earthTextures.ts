import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { mulberry32 } from '../math/rng';

/**
 * Procedural Earth textures drawn from Natural Earth 1:110m geography (world-atlas).
 * Everything is generated in the browser: no image downloads.
 */
export interface EarthTextures {
  day: HTMLCanvasElement; // colour map
  spec: HTMLCanvasElement; // oceans shiny, land matte
  glow: HTMLCanvasElement; // coastlines & borders that glow on the night side
  clouds: HTMLCanvasElement; // white cloud layer with alpha
}

export async function buildEarthTextures(width = 2048): Promise<EarthTextures> {
  const topo = (await import('world-atlas/countries-110m.json')).default as unknown as Topology<{
    countries: GeometryCollection;
    land: GeometryCollection;
  }>;
  const land = feature(topo, topo.objects.land);
  const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const W = width;
  const H = width / 2;
  const projection = geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2])
    .precision(0.5);
  const mk = (w = W, h = H) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const latY = (lat: number) => ((90 - lat) / 180) * H;

  // ── colour map ────────────────────────────────────────────
  const day = mk();
  const ctx = day.getContext('2d')!;
  const path = geoPath(projection, ctx);
  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#0b2a4a');
  ocean.addColorStop(0.18, '#0a3a66');
  ocean.addColorStop(0.5, '#0b4c85');
  ocean.addColorStop(0.82, '#0a3a66');
  ocean.addColorStop(1, '#0b2a4a');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);
  // shallow coastal shelves: a soft turquoise halo around every coast
  ctx.save();
  ctx.shadowColor = 'rgba(40,170,200,0.9)';
  ctx.shadowBlur = W / 180;
  ctx.fillStyle = '#1b6f96';
  ctx.beginPath();
  path(land);
  ctx.fill();
  ctx.restore();
  // land is coloured on its own transparent layer so climate bands never touch the sea
  const landLayer = mk();
  const lctx = landLayer.getContext('2d')!;
  lctx.fillStyle = '#3d7a3a';
  lctx.beginPath();
  geoPath(projection, lctx)(land);
  lctx.fill();
  lctx.save();
  lctx.globalCompositeOperation = 'source-atop';
  const bands = lctx.createLinearGradient(0, 0, 0, H);
  const stop = (lat: number, col: string) => bands.addColorStop(Math.min(1, Math.max(0, latY(lat) / H)), col);
  stop(90, '#f4f8fb');
  stop(72, '#e9eff3');
  stop(64, '#7f8f6e');
  stop(55, '#2f5a33');
  stop(42, '#4d7f3c');
  stop(32, '#a99a62');
  stop(22, '#c9a96b');
  stop(12, '#5d8a3a');
  stop(0, '#2f6f2c');
  stop(-12, '#5a8a3b');
  stop(-24, '#c2a167');
  stop(-34, '#8a8f55');
  stop(-48, '#4c7340');
  stop(-60, '#d9e3ea');
  stop(-90, '#f7fbfd');
  lctx.fillStyle = bands;
  lctx.fillRect(0, 0, W, H);
  // texture: speckled relief so land is not flat colour
  const rnd = mulberry32(7);
  for (let i = 0; i < 16000; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = (0.5 + rnd() * 2.2) * (W / 2048);
    lctx.fillStyle = rnd() > 0.5 ? `rgba(20,30,10,${0.03 + rnd() * 0.06})` : `rgba(240,230,190,${0.02 + rnd() * 0.05})`;
    lctx.beginPath();
    lctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
    lctx.fill();
  }
  lctx.restore();
  ctx.drawImage(landLayer, 0, 0);
  // faint graticule over the oceans for an observatory feel
  ctx.strokeStyle = 'rgba(160,200,255,0.06)';
  ctx.lineWidth = W / 2048;
  ctx.beginPath();
  path(geoGraticule10());
  ctx.stroke();

  // ── specular (water shines) ───────────────────────────────
  const spec = mk(W / 2, H / 2);
  const sctx = spec.getContext('2d')!;
  const spath = geoPath(
    geoEquirectangular()
      .scale(W / 2 / (2 * Math.PI))
      .translate([W / 4, H / 4]),
    sctx,
  );
  sctx.fillStyle = '#9a9a9a';
  sctx.fillRect(0, 0, W / 2, H / 2);
  sctx.fillStyle = '#080808';
  sctx.beginPath();
  spath(land);
  sctx.fill();

  // ── night-side glow: coastlines and borders ───────────────
  const glow = mk();
  const gctx = glow.getContext('2d')!;
  const gpath = geoPath(projection, gctx);
  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, W, H);
  gctx.strokeStyle = 'rgba(255,190,110,0.55)';
  gctx.lineWidth = W / 2048;
  gctx.beginPath();
  gpath(borders);
  gctx.stroke();
  gctx.strokeStyle = 'rgba(110,220,255,0.95)';
  gctx.lineWidth = (W / 2048) * 1.4;
  gctx.shadowColor = 'rgba(110,220,255,0.9)';
  gctx.shadowBlur = 4;
  gctx.beginPath();
  gpath(land);
  gctx.stroke();

  // ── clouds ────────────────────────────────────────────────
  const CW = 1024;
  const CH = 512;
  const clouds = mk(CW, CH);
  const cctx = clouds.getContext('2d')!;
  const crnd = mulberry32(42);
  for (let i = 0; i < 520; i++) {
    // more cloud along the storm tracks (~±50°) and the tropics
    const band = crnd();
    const lat = band < 0.35 ? (crnd() < 0.5 ? 1 : -1) * (40 + crnd() * 20) : band < 0.55 ? (crnd() - 0.5) * 16 : (crnd() - 0.5) * 150;
    const x = crnd() * CW;
    const y = ((90 - lat) / 180) * CH;
    const rx = 10 + crnd() * 46;
    const a = 0.08 + crnd() * 0.22;
    for (const dx of [-CW, 0, CW]) {
      const g = cctx.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      cctx.fillStyle = g;
      cctx.save();
      cctx.translate(x + dx, y);
      cctx.scale(1.8, 0.7);
      cctx.translate(-(x + dx), -y);
      cctx.beginPath();
      cctx.arc(x + dx, y, rx, 0, Math.PI * 2);
      cctx.fill();
      cctx.restore();
    }
  }
  return { day, spec, glow, clouds };
}
