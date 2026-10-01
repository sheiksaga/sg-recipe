/** Site base path, guaranteed to end with a slash. */
const raw = import.meta.env.BASE_URL;
export const base = raw.endsWith('/') ? raw : `${raw}/`;
