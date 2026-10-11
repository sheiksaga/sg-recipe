# sg-recipe

A cookbook of the world. Anyone can add a recipe — it appears on the site after a maintainer approves it.

**Site:** https://sheiksaga.github.io/sg-recipe/

---

## Add a recipe 

You only need a GitHub account and a web browser.

1. Open the [recipes folder](./recipes) and click **Add file → Create new file**.
2. Name the file with lowercase words separated by hyphens, ending in `.md`.
   Example: `aunt-rosas-fish-pie.md`. Pick a name nobody has used yet.
3. Copy the template below into the file and fill it in.
4. Scroll down, click **Propose changes**, then **Create pull request**.
5. A maintainer reviews it. If something is off, you'll get a comment explaining what to fix — editing the file on your PR updates it automatically.

### Template

```markdown
---
title: Hilda's world famous chicken curry
country: IN
region: Kerala
cuisine: indian
difficulty: easy
servings: 4 people
tags: [chicken, curry]
author:
  name: Hilda
  url: https://github.com/hilda
ingredients:
  - group: spices
    item: chilli powder
  - group: meat
    item: chicken
  - salt to taste
---

## Method

Write the steps here, in plain words, as paragraphs.
```

### The rules

- **`title`** (required) — the name of the dish.
- **`country`** (required) — where the recipe is from, as a **2-letter code**: `IN` for India, `MY` for Malaysia, `GB` for Britain. Full list: [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2). Disputed or mixed origin? A list is fine: `country: [IN, PK]`.
- **`region`** (optional) — state, province, or city, e.g. `Kerala`. If it's not on our map yet, a maintainer will add its dot.
- **`cuisine`**, **`subcuisine`**, **`difficulty`** (`easy` / `medium` / `hard`), **`servings`**, **`prep_minutes`**, **`cook_minutes`**, **`tags`** — all optional, all plain words or numbers.
- **`author`** (optional) — your name, and optionally a link (GitHub, blog, socials). You get credited at the bottom of the recipe.
- **`ingredients`** (required) — a list. Two ways to write an entry:
  - Just words: `- salt to taste`
  - Structured, when you know amounts:
    ```yaml
    - item: chicken (leg or thigh)
      qty: 800
      unit: g
      prep: cut into pieces
      group: meat
    ```
  `group` bundles ingredients under a subheading (spices, vegetables, …). All fields except `item` are optional. Quantities are **not** mandatory — family recipes are vague and that's fine.
- **The method** — everything below the second `---`. Write it as normal paragraphs. A `## Method` heading is customary but the text is yours.

A robot checks every pull request against these rules and comments in plain language if something doesn't parse. You can't break the site — the worst case is a polite error message.

### License

By submitting a recipe you agree it is published under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): anyone may share or adapt it, but they must **credit you** and share derivatives under the same license.

---

## For developers

```bash
npm install
npm run dev        # local site at http://localhost:4321/sg-recipe/
npm run build      # static build into dist/
npm run validate   # check all recipes against the schema
```

- Recipes live in [`recipes/`](./recipes) as markdown + YAML frontmatter.
- The schema is [`schema/recipe.ts`](./schema/recipe.ts) (zod). Astro validates it at build time; `scripts/validate-recipes.ts` re-checks it in CI with friendlier messages.
- Map data: country shapes from `world-atlas` (Natural Earth); region/city dots from [`data/regions.json`](./data/regions.json) — add new regions there as `name: {country, lat, lon}`.
- The map uses a **cylindrical equal-area** projection (Behrmann, ±30° standard parallels), defined in [`src/lib/cartography.ts`](./src/lib/cartography.ts) — shared by the homepage map and the recipe location plate — because `d3-geo` has no cylindrical equal-area. It is equal-area like Equal Earth, but its ±180° boundary is a *straight line*, which is what makes infinite horizontal panning an exact translate. Equal Earth cannot loop: being pseudocylindrical it spans `960·h(φ)` at latitude φ, so a translated copy tears open by `960·(1−h)` — 0 units at the equator but 184 at 80°N.
- `PHI0` in `src/lib/cartography.ts` trades mid-latitude shape against map height and polar stretch. Horizontal compression at latitude φ is `cos(φ₀)/cos(φ)`. ±30° renders India ~13% off true aspect and gives a 2.36:1 map; ±37.5° (Hobo-Dyer) is 27% off and 1.98:1. Changing it means re-running `build:admin1`, which the component detects and refuses to draw misaligned.
- The map opens on the whole world. A country is framed by `?country=XX` — which is what clicking a country on the map produces — and by the search box above it.
- The search box drives both the map and the list. The list filters on every keystroke; a term of at least three characters that **exactly** names a country or region flies the view there (`map:focus`, a custom event carrying an alpha-2 code or a place name — the page never sends geometry) and narrows the list to that country. Clearing the box sends the map home and drops the country filter. It deliberately refuses to guess — no prefixes, no substrings, no two-letter codes — because a partial name is a trap: `ch` is the code for Switzerland and `chi` is a unique prefix of Chile, so typing `chicken` would otherwise jump the map to Chile and leave the list filtered to a country with no recipes. (Substrings are worse: `indian` lands on the British Indian Ocean Territory.) A short alias table covers names the ISO list does not carry — `usa`, `uk`, `britain`, `uae`, `holland`, `burma`, `czechia`.
- Frames (`countryFrames` / `pointFrames` in `WorldMap.astro`) are resolved at build time and written into the page as JSON, because nothing about a frame depends on the browser. That keeps the math out of the client script and — more usefully — lets a small inline script apply `?country=` **before the first paint**. The main script is a bundled external module, so without it the world view would paint first and then visibly jump to the country you clicked.
- Country boxes use the **largest single polygon**. A naive bounding box is useless for France (Caribbean to the Indian Ocean) and the United States (past Hawaii); the largest polygon gives metropolitan France and the contiguous 48. It also sidesteps the antimeridian, since a country the seam splits contributes only its larger half.
- `FRAME_PAD` and the mask's clear centre are coupled: a framed country fills `1/FRAME_PAD` = 71% of the frame in whichever dimension binds, so raising `FRAME_PAD` without raising the mask stop makes framed countries grey at their own edges. It holds at `MAX_ZOOM` too, because `minWidth / FRAME_PAD` is exactly 71%.
- A recipe page shows a **static location plate** ([`src/components/OriginPlate.astro`](./src/components/OriginPlate.astro)): the world map cropped to the recipe's country, the country shaded and the region dotted, linking to the framed homepage view. It ships no client JS, and its geometry is both simplified harder (`PLATE_SIMPLIFY = 0.1`, against the homepage's 0.02) and **clipped to the frame** at build time, so a country emits only the sliver inside the window — Russia contributes a few points, not Siberia. That takes a plate from ~100 KB of path data to ~15 KB. On wide screens it sits in the article's right margin; below that it stacks after the metadata.
- Zoom is capped at 12× in `WorldMap.astro` — not an arbitrary number. The country layer is decimated to keep the homepage payload down, so microstates are a handful of points (Singapore and Bahrain are 4-point polygons). Beyond ~12× you are magnifying a low-poly shape rather than revealing detail. If you need deeper zoom, either raise the simplify threshold's detail (0.02 → 0.01 costs about +47 KB gzipped) or load a high-detail country layer lazily the way `admin1.json` does.
- Panning **east–west is infinite and exact**: the viewBox x wraps and a runtime clone provides the filler. Panning **north–south is finite**, deliberately. In a cylindrical projection the pole is a whole *edge* rather than a point, so there is nothing above 90°N to reveal — wrapping would butt the north pole edge against the south pole edge and repeat the world like wallpaper. Instead the map gets `vPad()` of whitespace past each pole (half a frame, capped) and a rubber band beyond that: drag resistance is applied to the *total* overshoot, not per event, so it eases off instead of dead-stopping, and `settle()` springs it back on release.
- Two artifacts come from the map's outer edge being stroked, and both are handled in the template. Antarctica's ring closes along 90°S, which vertical padding would expose as a hard rule *inside* the frame, so `EDGE_CLIP` trims 2 user units off the poles — costing no geography, since every pixel along the top and bottom edge *is* the pole. Russia's ring closes along the antimeridian for 5.4 units around 65–69°N, which the horizontal wrap lands exactly on the seam (a 56px spur at maximum zoom), so a `.seam-erase` hairline is stroked over it above both tiles. The trim must exceed half a stroke width in user units, which is widest when zoomed out on the narrowest screen (~1.34 units at a 358px viewport).
- State/province boundaries come from [`public/admin1.json`](./public/admin1.json), generated by `npm run build:admin1`. It is pre-projected, so re-run it if you change the projection in `WorldMap.astro` — the component detects a mismatch and skips the layer rather than drawing it misaligned. The script caches its 39 MB Natural Earth download in `.cache/`.
- CI: PRs touching `recipes/` are validated automatically; merges to `main` deploy to GitHub Pages.

## License

- **Recipes and site text:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode)
- **Site code:** [MIT](https://opensource.org/licenses/MIT)

See [LICENSE](./LICENSE).
