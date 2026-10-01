import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { recipeSchema } from '../schema/recipe';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './recipes' }),
  schema: recipeSchema,
});

export const collections = { recipes };
