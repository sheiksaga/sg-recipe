import { z } from 'zod';

const countryCode = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'country must be a 2-letter ISO code like IN or MY');

const ingredient = z.union([
  z.string().min(1),
  z.object({
    item: z.string().min(1),
    qty: z.union([z.number().positive(), z.string().min(1)]).optional(),
    unit: z.string().optional(),
    prep: z.string().optional(),
    group: z.string().optional(),
    note: z.string().optional(),
  }),
]);

export const recipeSchema = z.object({
  title: z.string().min(1),
  country: z
    .union([countryCode, z.array(countryCode).min(1)])
    .transform((v) => (Array.isArray(v) ? v : [v])),
  region: z.string().optional(),
  cuisine: z.string().optional(),
  subcuisine: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  servings: z.union([z.number().positive(), z.string().min(1)]).optional(),
  prep_minutes: z.number().positive().optional(),
  cook_minutes: z.number().positive().optional(),
  tags: z.array(z.string().min(1)).optional(),
  ingredients: z.array(ingredient).min(1),
  author: z
    .union([z.string().min(1), z.object({ name: z.string().min(1), url: z.string().url().optional() })])
    .optional(),
  source: z.string().optional(),
});

export type Recipe = z.infer<typeof recipeSchema>;
