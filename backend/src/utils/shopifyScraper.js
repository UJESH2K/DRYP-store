async function scrapeShopifyProduct(url) {
  // Normalise: strip query string so we can derive the handle for the JSON endpoint.
  let handle;
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const productsIdx = parts.indexOf('products');
    if (productsIdx >= 0 && parts[productsIdx + 1]) {
      handle = parts[productsIdx + 1];
      // Drop everything after the handle (e.g. ?variant=123, #review)
      u.hash = '';
      u.search = '';
      u.pathname = u.pathname.replace(/\/products\/[^/]+.*/, `/products/${handle}`);
      url = u.toString();
    }
  } catch {}

  // 1) Try the Shopify JSON product endpoint — gives variants, options,
  //    inventory, images, and tags in one structured response.
  if (handle) {
    try {
      const jsonUrl = `https://${new URL(url).host}/products/${handle}.json`;
      const res = await fetch(jsonUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (res.ok) {
        const data = await res.json();
        const p = data?.product;
        if (p) return parseShopifyJsonProduct(p);
      }
    } catch {}
  }

  // 2) HTML fallback (JSON-LD, __INITIAL_STATE__, meta tags).
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();

  // Try JSON-LD structured data first
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const script of jsonLdMatch) {
      try {
        const jsonMatch = script.replace(/<\/?script[^>]*>/gi, '').trim();
        const data = JSON.parse(jsonMatch);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'product') {
            return parseJsonLdProduct(item, url);
          }
        }
      } catch {}
    }
  }

  // Try Shopify product JSON in script tags (window.__INITIAL_STATE__)
  const initStateMatch = html.match(/window\s*\.\s*__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
  if (initStateMatch) {
    try {
      const stateData = JSON.parse(initStateMatch[1]);
      const productData = stateData?.product || stateData?.Product;
      if (productData) {
        return parseShopifyProductState(productData);
      }
    } catch {}
  }

  // Fallback: parse meta tags and basic HTML
  return parseBasicMeta(html, url);
}

function parseJsonLdProduct(data, url) {
  const images = [];
  if (data.image) {
    const imgArr = Array.isArray(data.image) ? data.image : [data.image];
    imgArr.forEach(img => {
      if (typeof img === 'string') images.push(img);
      else if (img?.url) images.push(img.url);
    });
  }

  const offers = Array.isArray(data.offers) ? data.offers : (data.offers ? [data.offers] : []);
  const minPrice = offers.length > 0
    ? Math.min(...offers.map(o => parseFloat(o.price) || Infinity))
    : null;

  return {
    name: data.name || '',
    description: data.description || '',
    brand: typeof data.brand === 'object' ? data.brand.name : (data.brand || ''),
    category: data.category || '',
    basePrice: minPrice || 0,
    images: images.filter(Boolean),
    tags: [], // JSON-LD doesn't usually include tags
    source: 'shopify',
    externalId: url,
    variants: offers.map(o => ({
      options: { 'Default': o.name || 'Default Title' },
      sku: o.sku || '',
      price: parseFloat(o.price) || 0,
      stock: o.availability?.includes('InStock') ? 999 : (o.availability?.includes('Limited') ? 10 : 0),
      images: [],
    })),
  };
}

function parseShopifyProductState(data) {
  const product = data.product || data;
  const images = (product.images || []).map(i => typeof i === 'string' ? i : (i.src || i.url || '')).filter(Boolean);
  const variants = (product.variants || []).map(v => ({
    options: { 'Default': v.title || 'Default Title' },
    sku: v.sku || '',
    price: parseFloat(v.price) || 0,
    stock: v.inventory_quantity || 0,
    images: [],
  }));

  return {
    name: product.title || '',
    description: product.description || '',
    brand: product.vendor || '',
    category: product.type || '',
    basePrice: variants.length > 0 ? Math.min(...variants.map(v => v.price)) : 0,
    images,
    tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
    source: 'shopify',
    externalId: product.handle || url,
    variants,
  };
}

// Parse the structured response from /products/<handle>.json
function parseShopifyJsonProduct(p) {
  const images = (p.images?.edges || []).map(e => e.node?.url || '').filter(Boolean);
  if (images.length === 0 && p.image) {
    images.push(typeof p.image === 'string' ? p.image : p.image?.url);
  }

  const variants = (p.variants?.edges || []).map(e => {
    const v = e.node;
    const opts = {};
    (v.selectedOptions || []).forEach(o => { opts[o.name] = o.value; });
    return {
      options: opts,
      sku: v.sku || '',
      price: parseFloat(v.price) || 0,
      stock: v.inventoryQuantity ?? 0,
      images: (v.image?.url ? [v.image.url] : []),
    };
  });

  return {
    name: p.title || '',
    description: p.descriptionHtml || p.description || '',
    brand: p.vendor || '',
    category: p.productType || '',
    basePrice: variants.length > 0 ? Math.min(...variants.map(v => v.price)) : parseFloat(p.priceRange?.minVariantPrice?.amount) || 0,
    images,
    tags: (p.tags?.edges || []).map(e => e.node?.value).filter(Boolean),
    source: 'shopify',
    externalId: p.handle || p.id || '',
    variants,
  };
}

function parseBasicMeta(html, url) {
  const getMeta = (prop) => {
    const regex = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${prop}["'][^>]+content\\s*=\\s*["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] : '';
  };

  const getMetaAlt = (prop) => {
    const regex = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:property|name)\\s*=\\s*["']${prop}["']`, 'i');
    const match = html.match(regex);
    return match ? match[1] : '';
  };

  const ogTitle = getMeta('og:title') || getMetaAlt('og:title');
  const ogDesc = getMeta('og:description') || getMetaAlt('og:description');
  const ogImage = getMeta('og:image') || getMetaAlt('og:image');
  const ogPrice = getMeta('product:price:amount') || getMetaAlt('product:price:amount');

  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/–.*$/, '').trim() : '';

  return {
    name: ogTitle || pageTitle || 'Untitled Product',
    description: ogDesc || '',
    brand: '',
    category: '',
    basePrice: parseFloat(ogPrice) || 0,
    images: ogImage ? [ogImage] : [],
    tags: [],
    source: 'shopify',
    externalId: url,
    variants: [{
      options: { 'Default': 'Default Title' },
      sku: '',
      price: parseFloat(ogPrice) || 0,
      stock: 0,
      images: [],
    }],
  };
}

module.exports = { scrapeShopifyProduct };
