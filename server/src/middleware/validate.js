// validate({ body, query, params }) parses with zod and replaces the parsed (stripped, coerced) values.
export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) { const parsed = schemas[key].parse(req[key] ?? {}); Object.defineProperty(req, key, { value: parsed, writable: true, configurable: true }); }
    }
    next();
  } catch (e) { next(e); }
};
