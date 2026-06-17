/**
 * products.js — request schemas for /api/products/*.
 *
 * Pair with `validate({ body/query/params: <schema> })` middleware in
 * src/routes/products.js. See schemas/auth.js for conventions.
 */

const { z } = require('zod');
const { objectId, name, pagination } = require('./common');

/**
 * Variant option. The product's `options` array defines axes (Color,
 * Size) and the `variants` array carries per-combination data.
 */
const variantOption = z.object({
  name: z.string().trim().min(1).max(50),
  values: z.array(z.string().trim().min(1).max(50)).min(1).max(50),
});

/**
 * A product variant — one specific combination of options.
 * Mirrors the `variants` subdoc in src/models/Product.js.
 */
const productVariant = z.object({
  options: z.record(z.string(), z.string()),
  sku: z.string().trim().max(100).optional(),
  stock: z.number().int().min(0).default(0),
  price: z.number().min(0),
  images: z.array(z.string().min(1)).default([]),
});

const description = z.string().trim().max(5000).optional();

/**
 * POST /api/products — create a new product (vendor-only).
 *   body: { name, brand, category, tags, basePrice, options, variants, images, ... }
 *
 * `basePrice` is the price when there are no variants. When variants
 * are present, the variant price wins.
 *
 * `vendor` is optional here: the route handler forces
 * `vendor = req.user._id` from auth, so we don't want to require
 * the client to send it. For the Excel import (Phase 3A) the route
 * also injects vendor before validation runs.
 */
const create = z
  .object({
    name,
    description,
    brand: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(50),
    tags: z.array(z.string().trim().min(1).max(50)).default([]),
    basePrice: z.number().min(0),
    sku: z.string().trim().max(100).optional(),
    stock: z.number().int().min(0).default(0),
    options: z.array(variantOption).default([]),
    variants: z.array(productVariant).default([]),
    images: z.array(z.string().min(1)).default([]),
    vendor: z.string().trim().optional(),
  });

/**
 * PUT /api/products/:id — update. All fields optional except that
 * arrays, if present, must be arrays (we don't merge array fields
 * with the existing document on PATCH).
 */
const update = z
  .object({
    name: name.optional(),
    description,
    brand: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(50).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).optional(),
    basePrice: z.number().min(0).optional(),
    sku: z.string().trim().max(100).optional(),
    stock: z.number().int().min(0).optional(),
    options: z.array(variantOption).optional(),
    variants: z.array(productVariant).optional(),
    images: z.array(z.string().min(1)).optional(),
  })
  .strict();

/**
 * GET /api/products — list with filters. Comma-separated multi-values
 * (e.g. `?category=tops,dresses`) are split into arrays in the route.
 */
const listQuery = pagination.extend({
  brand: z.string().trim().default(''),
  category: z.string().trim().default(''),
  color: z.string().trim().default(''),
  search: z.string().trim().default(''),
  vendor: z.string().trim().default(''),
  tag: z.string().trim().default(''),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

const idParam = z.object({ id: objectId });

module.exports = {
  create,
  update,
  listQuery,
  idParam,
};