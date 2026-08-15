const Product = require('../models/Product');

/**
 * Floor-guarded, idempotent stock decrement for a paid order.
 * Variants (no _id, identity = sku or Size) decrement via sku then
 * options.Size; simple products decrement base stock. The stock >= qty
 * filter guarantees stock never goes negative.
 *
 * Returns { ok, shortItems }. When a decrement matches nothing, the
 * product is re-read: if the product (or its variant) still exists, the
 * floor guard failed because stock < qty, so the item is recorded as
 * short with the available stock. If the product is gone, there is
 * nothing to decrement and the item is not flagged.
 */
async function decrementOrderStock(order) {
  const shortItems = [];
  for (const item of order.items) {
    const qty = Math.max(1, item.quantity || 1);
    const productId = item.product;
    if (item.variantKey) {
      const skuRes = await Product.updateOne(
        { _id: productId, 'variants.sku': item.variantKey, 'variants.stock': { $gte: qty } },
        { $inc: { 'variants.$.stock': -qty } }
      );
      if (skuRes.modifiedCount === 0) {
        const sizeRes = await Product.updateOne(
          { _id: productId, 'variants.options.Size': item.variantKey, 'variants.stock': { $gte: qty } },
          { $inc: { 'variants.$.stock': -qty } }
        );
        if (sizeRes.modifiedCount === 0) {
          const product = await Product.findById(productId);
          if (product) {
            const variants = product.variants || [];
            const variant =
              variants.find(v => v.sku === item.variantKey) ||
              variants.find(v => v.options.get('Size') === item.variantKey);
            if (variant) {
              shortItems.push({ product: productId, qty, available: Math.max(0, variant.stock || 0) });
            }
          }
        }
      }
    } else {
      const res = await Product.updateOne(
        { _id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } }
      );
      if (res.modifiedCount === 0) {
        const product = await Product.findById(productId);
        if (product) {
          shortItems.push({ product: productId, qty, available: Math.max(0, product.stock || 0) });
        }
      }
    }
  }
  return { ok: shortItems.length === 0, shortItems };
}

module.exports = { decrementOrderStock };
