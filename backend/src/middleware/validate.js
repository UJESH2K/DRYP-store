/**
 * validate.js
 *
 * Zod-based request validation middleware factory.
 *
 * Usage:
 *   const { validate, schemas } = require('../middleware/validate');
 *
 *   router.post('/login',
 *     validate({ body: schemas.auth.login }),
 *     async (req, res) => { ... }
 *   );
 *
 *   router.put('/me',
 *     validate({ body: schemas.vendor.update, params: z.object({ id: objectId }) }),
 *     ...
 *   );
 *
 * Why zod:
 *   - One schema for both runtime validation and type generation.
 *   - Detailed, structured error messages out of the box.
 *   - Parses (coerces) string params and query strings to typed values.
 *   - Composable: `refine` + `superRefine` for cross-field rules.
 *
 * Error contract:
 *   On validation failure we return 400 with:
 *     {
 *       message: 'Validation failed',
 *       errors: [{ path: 'body.email', message: 'Invalid email' }, ...]
 *     }
 *   This shape is consistent across the API so the client can render the
 *   errors without inspecting different formats per endpoint.
 */

const { ZodError } = require('zod');

/**
 * Build a middleware that validates `req[location]` against a zod schema.
 *
 * @param {object} map
 *   e.g. { body: <schema>, query: <schema>, params: <schema> }
 *   Any subset of {body, query, params}. Missing locations are skipped.
 * @param {object} [opts]
 * @param {string[]} [opts.stripUnknown=true] - Drop unknown keys from objects
 *   before they reach the handler. Useful for body sanitization.
 *   (zod v3 has a `passthrough`/`strict`/`strip` mode; we default to strip.)
 */
function validate(map, opts = {}) {
  const { stripUnknown = true } = opts;

  return function validateMiddleware(req, res, next) {
    const errors = [];

    for (const location of ['body', 'query', 'params']) {
      const schema = map[location];
      if (!schema) continue;

      const data = req[location];
      const result = schema.safeParse(data);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            path: `${location}.${issue.path.join('.')}`,
            message: issue.message,
            code: issue.code,
          });
        }
        continue;
      }

      // Replace the raw input with the parsed (and stripped/coerced) version.
      // This means handlers always see clean, typed data — they don't have
      // to re-cast query params or strip extra fields themselves.
      if (stripUnknown) {
        req[location] = result.data;
      } else {
        // Even with stripUnknown=false, we want the coerced values (e.g.
        // numeric query params) to be reflected back on req.
        Object.assign(req[location], result.data);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
}

module.exports = { validate, ZodError };
