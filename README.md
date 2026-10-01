# sg-recipe

A cookbook of the world. Anyone can add a recipe — it appears on the site after a maintainer approves it.

**Site:** https://sheiksaga.github.io/sg-recipe/

---

## Add a recipe (no programming needed)

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

### The rules, in plain words

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
- CI: PRs touching `recipes/` are validated automatically; merges to `main` deploy to GitHub Pages.

## License

- **Recipes and site text:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode)
- **Site code:** [MIT](https://opensource.org/licenses/MIT)

See [LICENSE](./LICENSE).
