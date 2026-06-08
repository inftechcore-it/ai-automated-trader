const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function set(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function del(key) {
  cache.delete(key);
}

export function clear() {
  cache.clear();
}
