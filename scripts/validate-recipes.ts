/**
 * Validates every recipe in ./recipes against schema/recipe.ts.
 * Run locally:  node scripts/validate-recipes.ts
 * Runs automatically on every pull request that touches recipes/.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import regions from '../data/regions.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';
import { recipeSchema } from '../schema/recipe.ts';

countries.registerLocale(enLocale);

const RECIPES_DIR = fileURLToPath(new URL('../recipes/', import.meta.url));
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let failures = 0;
const seen = new Map<string, string>();

function fail(file: string, message: string) {
  failures++;
  console.error(`✗ ${file}: ${message}`);
}

const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.md'));
if (files.length === 0) {
  console.log('No recipes found.');
  process.exit(0);
}

for (const file of files) {
  const slug = file.replace(/\.md$/, '');

  if (!SLUG_RE.test(slug)) {
    fail(file, `filename "${slug}" must be kebab-case letters and numbers, e.g. hildas-chicken-curry.md`);
  }
  if (seen.has(slug)) {
    fail(file, `duplicate slug "${slug}" also used by ${seen.get(slug)}`);
  }
  seen.set(slug, file);

  let parsed;
  try {
    parsed = matter(readFileSync(join(RECIPES_DIR, file), 'utf8'));
  } catch (err) {
    fail(file, `could not read the frontmatter block: ${err}`);
    continue;
  }

  const result = recipeSchema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const where = issue.path.length ? issue.path.join('.') : '(top level)';
      fail(file, `${where}: ${issue.message}`);
    }
    continue;
  }

  for (const code of result.data.country) {
    if (!countries.getName(code, 'en')) {
      fail(file, `country "${code}" is not a real ISO 3166-1 alpha-2 code (examples: IN, MY, GB). See https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2`);
    }
  }

  if (result.data.region && !(regions as Record<string, unknown>)[result.data.region.toLowerCase()]) {
    console.warn(`! ${file}: region "${result.data.region}" has no dot on the map yet — add it to data/regions.json`);
  }

  if (!parsed.content.trim()) {
    fail(file, 'the recipe has no method — write the steps below the frontmatter block');
  }
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found. Fix them and push again — ask in the PR if anything is unclear.`);
  process.exit(1);
}
console.log(`✓ ${files.length} recipe(s) valid.`);
