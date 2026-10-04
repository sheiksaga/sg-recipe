/**
 * Regenerates public/admin1.json — first-order administrative boundaries
 * (states, provinces, oblasts, regions) for the world map.
 *
 * Natural Earth's admin-1 layer *is* each country's own first-order division,
 * so this follows local convention rather than imposing one scheme: states for
 * the US, India and Australia, provinces for Canada and China, oblasts and
 * republics for Russia. Countries without meaningful first-order divisions
 * (city-states, small islands) simply have no features, which is correct.
 *
 * We use the 10m layer because the 50m one only covers 9 countries. Simplified
 * and projected it lands at ~320 KB of path data, ~95 KB gzipped, which the
 * page fetches lazily rather than inlining.
 *
 * Only *intra-country* boundaries are emitted: arcs shared by two regions of the
 * same country. Country borders and coastlines are already drawn by the country
 * layer, so including them here would double-stroke them in the wrong colour.
 *
 * IMPORTANT: paths are pre-projected with the same projection and viewBox as
 * WorldMap.astro, so the browser needs no d3. If you change the projection or
 * the fitted size there, re-run this script — the component compares the stored
 * `world` box and skips the layer if it no longer matches.
 *
 *   node scripts/build-admin1.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';
import topojsonSimplify from 'topojson-simplify';
import { mesh } from 'topojson-client';
import { geoPath, geoProjection } from 'd3-geo';

const { presimplify, simplify } = topojsonSimplify as any;

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

// Cache the 39 MB download so re-runs are instant. Gitignored.
const CACHE = fileURLToPath(new URL('../.cache/admin1-ne10.geojson', import.meta.url));
const OUT = fileURLToPath(new URL('../public/admin1.json', import.meta.url));

// Quantisation and simplification. 1e3 keeps sub-pixel precision at the fitted
// 960-unit width; 0.5 drops ~60% of points before quality visibly changes.
const QUANTISATION = 1e3;
const THRESHOLD = 0.5;

// Must match WorldMap.astro.
const WIDTH = 960;
const HEIGHT = 500;

async function loadSource(): Promise<any> {
  if (existsSync(CACHE)) {
    console.log(`Using cached ${CACHE}`);
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  }
  console.log(`Downloading ${SOURCE}`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  mkdirSync(fileURLToPath(new URL('../.cache/', import.meta.url)), { recursive: true });
  writeFileSync(CACHE, text);
  console.log(`Cached ${(text.length / 1048576).toFixed(1)} MB`);
  return JSON.parse(text);
}

const geojson = await loadSource();
const countries = new Set(geojson.features.map((f: any) => f.properties.adm0_a3));
console.log(`${geojson.features.length} regions across ${countries.size} countries`);

const topo = topology({ admin1: geojson }, QUANTISATION);
const simplified = simplify(presimplify(topo), THRESHOLD);

// Internal arcs only, and only where both sides belong to the same country.
const boundary = mesh(
  simplified,
  (simplified as any).objects.admin1,
  (a: any, b: any) => a !== b && a.properties?.adm0_a3 === b.properties?.adm0_a3,
);

/**
 * Match the precision WorldMap.astro uses for the country layer — three decimals
 * from d3 is finer than anything can render and costs gzip entropy.
 */
const roundPath = (d: string) =>
  d.replace(/-?\d+\.\d+/g, (n) => {
    const r = Number(n).toFixed(2);
    return r.replace(/\.?0+$/, '') || '0';
  });

// Must match WorldMap.astro — Behrmann cylindrical equal-area at ±30°.
const PHI0 = 30;
const K = Math.cos((PHI0 * Math.PI) / 180);

const projection = geoProjection((lambda: number, phi: number) => [lambda * K, Math.sin(phi) / K]).fitSize(
  [WIDTH, HEIGHT],
  { type: 'Sphere' } as any,
);
const path = geoPath(projection as any);
const d = roundPath(path(boundary as any) ?? '');

const sphere = path.bounds({ type: 'Sphere' } as any) as [[number, number], [number, number]];
const world = [sphere[0][0], sphere[0][1], sphere[1][0] - sphere[0][0], sphere[1][1] - sphere[0][1]].map(
  (n) => Math.round(n * 1e3) / 1e3,
);

mkdirSync(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
writeFileSync(OUT, JSON.stringify({ world, d }));

const bytes = readFileSync(OUT).length;
const gz = (await import('node:zlib')).gzipSync(readFileSync(OUT)).length;
console.log(`Wrote ${OUT} — ${(bytes / 1024).toFixed(0)} KB (${(gz / 1024).toFixed(0)} KB gzipped)`);
console.log(`world box: ${world.join(' ')}`);
