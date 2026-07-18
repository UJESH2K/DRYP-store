// ─── Shopify detection for arbitrary URLs ─────────────────────────
// Returns { isShopify, method } where method is the signal that confirmed it.
// Used when a vendor pastes a custom-domain URL (clothingbrand.com) so we
// know whether to attempt a Shopify scrape at all.

const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') return new Response(null, { status: 408 });
    throw error;
  } finally {
    clearTimeout(id);
  }
}

async function detectShopify(url) {
  const domain = new URL(url).host;

  // 1) Try /products.json — public on 90%+ Shopify stores, returns structured data
  try {
    const r = await fetchWithTimeout(`https://${domain}/products.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.products)) return { isShopify: true, method: 'products.json' };
    }
  } catch {}

  // 2) Try /meta.json — returns { "myshopify_domain": "..." } on all Shopify stores
  try {
    const r = await fetchWithTimeout(`https://${domain}/meta.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (r.ok) {
      const data = await r.json();
      if (data.myshopify_domain) return { isShopify: true, method: 'meta.json' };
    }
  } catch {}

  // 3) HTML fingerprint — look for Shopify globals or CDN
  try {
    const r = await fetchWithTimeout(`https://${domain}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (r.ok) {
      const html = await r.text();
      if (/cdn\.shopify\.com/.test(html)) return { isShopify: true, method: 'cdn-fingerprint' };
      if (/window\.Shopify/.test(html)) return { isShopify: true, method: 'shopify-global' };
      if (/x-shopify-stage/.test(html)) return { isShopify: true, method: 'shopify-header' };
    }
  } catch {}

  return { isShopify: false, method: null };
}

async function scrapeShopifyProduct(url) {
  // If the URL is not a Shopify store, return early instead of silently
  // returning garbage metadata from a non-Shopify HTML page.
  const { isShopify } = await detectShopify(url);
  if (!isShopify) {
    throw new Error('URL does not appear to be a Shopify store');
  }

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

  if (!handle) {
    throw new Error(
      'URL does not point to a Shopify product page. Expected a URL like https://store.com/products/product-name. Collection or homepage URLs are not supported.',
    );
  }

  // 1) Try the Shopify JSON product endpoint — gives variants, options,
  //    inventory, images, and tags in one structured response.
  //    Guard against Shopify's "soft redirect": dead handles return a
  //    different product's JSON with HTTP 200, so we must verify the
  //    returned handle matches what we asked for.
  try {
    const jsonUrl = `https://${new URL(url).host}/products/${handle}.json`;
    const res = await fetchWithTimeout(jsonUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.ok) {
      const data = await res.json();
      const p = data?.product;
      // p.handle === handle means we got the exact product we asked for.
      // If it differs, Shopify silently redirected us — fall through.
      if (p && p.handle === handle) return parseShopifyJsonProduct(p);
    }
  } catch {}

  // 1b) Fetch the product page HTML — OG meta / JSON-LD always reflect the
  // exact product the user pasted, unlike /products.json where we must fuzzy-match.
  let htmlMeta;
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (response.ok) htmlMeta = await response.text();
  } catch {}

  // Many Shopify SPAs return HTTP 200 with an error/redirect page for dead
  // product handles (e.g. "Something went wrong"). Detect real product pages
  // by JSON-LD, product:price meta, or og:image (present on virtually all
  // Shopify product pages). Additionally, the page <title> must contain at
  // least one word from the product handle to avoid matching the homepage.
  const hasProductMarkup = htmlMeta && (
    htmlMeta.includes('application/ld+json') ||
    htmlMeta.includes('product:price') ||
    htmlMeta.includes('og:image')
  );
  const isProductPage = hasProductMarkup && (() => {
    if (!hasProductMarkup) return false;
    const titleMatch = htmlMeta.match(/<title>([^<]*)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].toLowerCase() : '';
    const handleWords = handle.toLowerCase().replace(/[-_]/g, ' ').split(' ').filter((w) => w.length > 2);
    return handleWords.some((w) => pageTitle.includes(w));
  })();
  if (!isProductPage) htmlMeta = undefined;

  // 1c) Extract from JSON-LD first (rich, structured product data).
  if (htmlMeta) {
    const jsonLdMatch = htmlMeta.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
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
  }

  // 1c) Fallback: /products.json listing + word-overlap handle match.
  // Only fires when the product page HTML returned no parseable data (SPA
  // with no static OG meta / JSON-LD). Requires >= 2 word matches AND the
  // best match must be uniquely better than the runner-up (no ties — if
  // two products share the same overlap, we can't know which is correct).
  if (handle && !htmlMeta) {
    try {
      const listingUrl = `https://${new URL(url).host}/products.json`;
      const listingRes = await fetchWithTimeout(listingUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (listingRes.ok) {
        const { products = [] } = await listingRes.json();
        const urlWords = handle.toLowerCase().replace(/[-_]/g, ' ').split(' ').filter((w) => w.length > 2);
        const urlSet = new Set(urlWords);
        const scored = products
          .filter((p) => p.handle)
          .map((p) => {
            const handleWords = p.handle.toLowerCase().replace(/[-_]/g, ' ').split(' ').filter((w) => w.length > 2);
            const overlap = handleWords.filter((w) => urlSet.has(w)).length;
            return { product: p, overlap };
          })
          .filter((s) => s.overlap > 0)
          .sort((a, b) => b.overlap - a.overlap);

        // Require >= 2 word matches AND the best match must be unique
        if (scored.length >= 1 && scored[0].overlap >= 2) {
          const unique = scored.length === 1 || scored[0].overlap > scored[1].overlap;
          if (unique) return parseShopifyJsonProduct(scored[0].product);
        }
      }
    } catch {}
  }

  // If we got HTML but no JSON-LD, parse OG meta / basic HTML
  if (htmlMeta) {
    return parseBasicMeta(htmlMeta, url);
  }

  // Nothing worked — throw a clear error instead of returning garbage.
  throw new Error(
    `Unable to scrape product data from ${url}: the Shopify store did not return product data. The product may be unavailable or the URL may not be a Shopify product page.`,
  );
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

function parseShopifyJsonProduct(p) {
  let images = [];
  if (Array.isArray(p.images)) {
    // REST Admin API format: images is a flat array of { src, url }
    images = p.images.map(i => typeof i === 'string' ? i : (i.src || i.url || '')).filter(Boolean);
  }
  // Storefront API format: images.edges[].node.url
  if (images.length === 0 && p.images?.edges) {
    images = (p.images.edges || []).map(e => e.node?.url || '').filter(Boolean);
  }
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

  // REST Admin API format: flat variants array
  const restVariants = Array.isArray(p.variants) && !p.variants.edges
    ? p.variants.map(v => {
        const opts = {};
        (v.selectedOptions || []).forEach(o => { opts[o.name] = o.value; });
        return {
          options: opts,
          sku: v.sku || '',
          price: parseFloat(v.price) || 0,
          stock: v.inventory_quantity ?? 0,
          images: (v.image?.src ? [v.image.src] : v.image?.url ? [v.image.url] : []),
        };
      })
    : null;

  return {
    name: p.title || '',
    description: p.descriptionHtml || p.description || '',
    brand: p.vendor || '',
    category: p.productType || '',
    basePrice: variants.length > 0
      ? Math.min(...variants.map(v => v.price))
      : (restVariants?.length ? Math.min(...restVariants.map(v => v.price)) : parseFloat(p.priceRange?.minVariantPrice?.amount) || 0),
    images,
    tags: (p.tags?.edges || []).map(e => e.node?.value).filter(Boolean),
    source: 'shopify',
    externalId: p.handle || p.id || '',
    variants: restVariants || variants,
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
