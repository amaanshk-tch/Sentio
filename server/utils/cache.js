const cache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_MAX_BYTES = 50 * 1024 * 1024;

let currentBytes = 0;

export function cacheGet(k) {
  const e = cache.get(k);
  if (!e || Date.now() > e.expiry) {
    if (e) {
      currentBytes -= e._size;
    }
    cache.delete(k);
    return null;
  }
  cache.delete(k);
  cache.set(k, e);
  return e.data;
}

export function cacheSet(k, d) {
  if (cache.has(k)) {
    const old = cache.get(k);
    currentBytes -= old._size;
    cache.delete(k);
  }

  const serialized = JSON.stringify(d);
  const size = serialized.length * 2;

  while (currentBytes + size > CACHE_MAX_BYTES && cache.size > 0) {
    const oldest = cache.keys().next().value;
    currentBytes -= cache.get(oldest)._size;
    cache.delete(oldest);
  }

  cache.set(k, { data: d, expiry: Date.now() + CACHE_TTL_MS, _size: size });
  currentBytes += size;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now > v.expiry) {
      currentBytes -= v._size;
      cache.delete(k);
    }
  }
}, 2 * 60 * 1000);
