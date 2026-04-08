const cache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_MAX    = 500; // max entries before LRU eviction

export function cacheGet(k) {
  const e = cache.get(k);
  if (!e || Date.now() > e.expiry) {
    cache.delete(k);
    return null;
  }
  // Refresh access order (LRU: move to end)
  cache.delete(k);
  cache.set(k, e);
  return e.data;
}

export function cacheSet(k, d) {
  // Evict oldest entry when at capacity
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(k, { data: d, expiry: Date.now() + CACHE_TTL_MS });
}

// Periodic cleanup of expired entries (every 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now > v.expiry) cache.delete(k);
  }
}, 2 * 60 * 1000);
