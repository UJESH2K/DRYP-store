/**
 * reviews.js — request schemas for /api/products/:id/reviews.
 *
 * Reviews are 1-5 stars with an optional comment. The product id
 * is the ObjectId param on the parent route.
 */
const { z } = require('zod');
const { objectId } = require('./common');

const idParam = z.object({ id: objectId });

const create = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
}).strict();

module.exports = { idParam, create };