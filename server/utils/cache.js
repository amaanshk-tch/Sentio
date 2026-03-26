const cache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export function cacheGet(k) { 
  const e = cache.get(k); 
  if (!e || Date.now() > e.expiry) { 
    cache.delete(k); 
    return null; 
  } 
  return e.data; 
}

export function cacheSet(k, d) { 
  cache.set(k, { data: d, expiry: Date.now() + CACHE_TTL_MS }); 
}
