/**
 * Build-time cartography, shared by the interactive world map (`WorldMap.astro`)
 * and the static location plate on a recipe page.
 *
 * Everything here runs during the build. `d3-geo`, topojson and the world-atlas
 * data are deliberately never shipped to the browser, so the projection is a
 * single source of truth: if it changes, the homepage, every plate, and the
 * pre-projected `admin1` layer must be rebuilt together (see
 * `scripts/build-admin1.ts`).
 */
import { feature } from 'topojson-client';
import { geoClipRectangle, geoPath, geoProjection } from 'd3-geo';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import worldRaw from 'world-atlas/countries-50m.json';
import topojsonSimplify from 'topojson-simplify';

countries.registerLocale(enLocale);
const { presimplify, simplify } = topojsonSimplify;

/**
 * world-atlas ships 110m and 50m. 110m is ~1/6th the weight but omits every
 * country smaller than roughly Luxembourg — including Singapore, on a site
 * called sg-recipe. 50m has 241 countries; unsimplified it would add ~560 KB
 * gzipped of path data to the homepage, so we drop points below a weight
 * threshold at build time. 0.02 keeps islands and real coastlines at ~143 KB.
 */
export const topology = simplify(presimplify(structuredClone(worldRaw)), 0.02);
export const land = feature(topology as any, (topology as any).objects.countries) as any;

/**
 * A coarser topology for the recipe plate. The homepage keeps 0.02 because it draws
 * the whole world at up to 12x zoom, where decimation shows; the plate is small and
 * fixed, so it can shed far more detail without the eye noticing — and every recipe
 * page inlines its own copy, so the weight matters.
 */
export const PLATE_SIMPLIFY = 0.1;
const plateTopology = simplify(presimplify(structuredClone(worldRaw)), PLATE_SIMPLIFY);
export const plateLand = feature(plateTopology as any, (plateTopology as any).objects.countries) as any;

const width = 960;
const height = 500;
/**
 * Behrmann: cylindrical equal-area, standard parallels at ±30°.
 *
 * Chosen over Equal Earth for one decisive reason: Equal Earth is
 * pseudocylindrical, so its ±180° boundary is a *curve* and the map spans
 * 960·h(φ) at latitude φ — which makes horizontal looping impossible with a plain
 * translate (it tears open by 960·(1-h) at each latitude). A cylindrical
 * projection has a straight vertical boundary, so the world tiles exactly and
 * looping costs nothing but a wrapped viewBox.
 *
 * d3-geo has no cylindrical equal-area built in, so the raw form is supplied
 * directly: x = λ·cos(φ₀), y = sin(φ)/cos(φ₀). Area is preserved exactly, which
 * was the reason for Equal Earth in the first place.
 *
 * φ₀ trades mid-latitude shape against polar stretch and map height. A cylindrical
 * equal-area compresses horizontally by cos(φ₀)/cos(φ) at latitude φ, so the flat
 * band sits at φ₀. At ±37.5° (Hobo-Dyer) India renders 27% too tall and narrow;
 * at ±30° it is 13% off and the map is ~70px shorter, at the cost of ~9% more
 * stretch at 60°N. Aspect works out at 2.36:1.
 */
const PHI0 = 30;
const K = Math.cos((PHI0 * Math.PI) / 180);
/** The raw cylindrical equal-area form, fitted differently by each projection below. */
const rawProjection = (lambda: number, phi: number): [number, number] => [lambda * K, Math.sin(phi) / K];
export const projection = geoProjection(rawProjection).fitSize([width, height], { type: 'Sphere' } as any);
export const pathGen = geoPath(projection as any);

/**
 * A path generator clipped to a frame on the page plane, for the recipe plate. It
 * emits only the part of a country that falls inside its window — Russia contributes
 * a sliver, not Siberia — which cuts the inlined geometry roughly seven-fold. Clipping
 * is exact because the projection's ±180° boundary is a straight line, so a country
 * never needs to be split at the seam.
 */
export function clippedPathGen(frame: number[]) {
  const p = geoProjection(rawProjection).fitSize([width, height], { type: 'Sphere' } as any);
  p.postclip(geoClipRectangle(frame[0], frame[1], frame[0] + frame[2], frame[1] + frame[3]) as any);
  return geoPath(p as any);
}

/**
 * Fit to the sphere's actual bounds rather than the nominal 960x500 box. The
 * cylindrical sphere is 2.36:1, so the nominal box would leave a dead band above
 * and below and squash Antarctica onto the bottom edge.
 */
const sphereBounds = pathGen.bounds({ type: 'Sphere' } as any) as [[number, number], [number, number]];
const [vx0, vy0] = sphereBounds[0];
const vx1 = sphereBounds[1][0];
const vy1 = sphereBounds[1][1];

/** Outer limit — how far the viewer can zoom out and pan. */
export const world = [vx0, vy0, vx1 - vx0, vy1 - vy0];
export const aspect = world[2] / world[3];

/**
 * Countries are stroked, and so is the map's own outer edge: Antarctica's ring
 * closes along 90°S, and the rings of countries that meet the antimeridian close
 * along ±180°. While the map exactly filled the frame those lines sat on the frame
 * boundary and were invisible, but vertical padding now pulls the north and south
 * edges inside the frame where the stroke shows as a hard rule.
 *
 * Clipping this much off the top and bottom removes the pole stroke, and costs no
 * geography: every pixel along the map's top and bottom edge *is* the pole, a single
 * point stretched into a line. At the deepest zoom it is ~20 CSS px, all of it
 * inside 89.4°, which is an empty cap of ice. It must exceed half a stroke width in
 * user units, which is widest when zoomed out on the narrowest screen: ~1.34 units
 * on a 358px-wide viewport at full zoom-out.
 */
export const EDGE_CLIP = 2;

export function toAlpha2(id: string | number): string | undefined {
  try {
    return countries.numericToAlpha2(String(id).padStart(3, '0')) as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * The path data is ~91% of the rendered homepage, so coordinate precision is the
 * single biggest lever available. d3 emits three decimals; at the fitted 960-unit
 * width that is ~0.001 units, far finer than anything can draw, and the extra
 * digits cost a lot of gzip entropy. Two decimals is still sub-pixel at the 12x
 * maximum zoom, and drops the gzipped geometry ~17%.
 */
export const roundPath = (d: string) =>
  d.replace(/-?\d+\.\d+/g, (n) => {
    const r = Number(n).toFixed(2);
    return r.replace(/\.?0+$/, '') || '0';
  });

/**
 * Per-country bounding boxes, the index the search box, `?country=` framing and
 * the recipe plate all key against.
 *
 * Overseas territories make a naive box useless: France's reaches from the Caribbean
 * to the Indian Ocean, the United States' past Hawaii, so framing them would show half
 * a hemisphere. Only the largest single polygon counts, which yields metropolitan
 * France and the contiguous 48. That also sidesteps the antimeridian — a country the
 * seam splits contributes just its larger half, so no box straddles the map edge.
 *
 * Emitted to the page as JSON on the map element. Keyed by alpha-2, so names come
 * free from the country-name table the page already inlines, and 235 boxes cost
 * about 3 KB gzipped.
 */
export const countryBoxes: Record<string, number[]> = {};
for (const f of land.features as any[]) {
  const code = toAlpha2(f.id);
  if (!code || !f.geometry) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best: number[] | null = null;
  let bestArea = -1;
  for (const poly of polys) {
    const b = pathGen.bounds({ type: 'Polygon', coordinates: poly }) as [[number, number], [number, number]];
    const area = (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]);
    if (area > bestArea) {
      bestArea = area;
      best = [b[0][0], b[0][1], b[1][0], b[1][1]];
    }
  }
  if (best) countryBoxes[code] = best.map((n) => +n.toFixed(1));
}

/**
 * Ceiling on zoom, as a multiple of world width. The limit here is the data, not the
 * code: the 50m country layer decimates hard at these scales, so microstates are a
 * handful of points (Singapore and Bahrain are 4-point polygons, Malta and
 * Luxembourg 8). Past ~12x you are magnifying a low-poly shape rather than revealing
 * detail — see the README for the detail levers. Reaching 12x comfortably covers the
 * small-but-real countries: Lebanon, Brunei, Trinidad and Cyprus all land at 25-35px
 * wide.
 *
 * Lives here rather than in the browser script because the framed boxes below are
 * computed against it, and those are build-time constants.
 */
export const MAX_ZOOM = 12;
export const minWidth = world[2] / MAX_ZOOM;

/**
 * Frame a box in map units: fixed map aspect, uniform padding, floored span.
 *
 * The floor is load-bearing. A handful of microstates are four-point polygons with a
 * literally zero-width bounding box — Singapore, Vatican, Guam — so without it the
 * zoom divides by zero. It only needs to defeat that; too large a floor would cap
 * every small country. Genuinely tiny places instead land on MAX_ZOOM via minWidth.
 *
 * Padding also keeps a framed country clear of the feathered edge: at FRAME_PAD it
 * fills 1/1.4 = 71% of the frame in whichever dimension binds, inside the mask's 75%
 * clear centre. That holds even at MAX_ZOOM, because minWidth / FRAME_PAD is exactly
 * 71%. Raise FRAME_PAD and the mask has to follow, or countries grey at their edges.
 */
export const FRAME_PAD = 1.4;
export const MIN_SPAN = 12;
/** A named point has no extent of its own, so it gets a fixed zoom instead. */
export const POINT_ZOOM = 8;

export const fitFrame = (cx: number, cy: number, w: number, h: number): number[] => [
  Math.min(Math.max(cx - w / 2, world[0]), world[0] + world[2] - w),
  Math.min(Math.max(cy - h / 2, world[1]), world[1] + world[3] - h),
  w,
  h,
];

export const frameBox = (b: number[]): number[] => {
  const bw = Math.max(b[2] - b[0], MIN_SPAN);
  const bh = Math.max(b[3] - b[1], MIN_SPAN);
  const w = Math.min(world[2], Math.max(bw * FRAME_PAD, bh * FRAME_PAD * aspect, minWidth));
  return fitFrame((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, w, w / aspect).map((n) => +n.toFixed(1));
};
