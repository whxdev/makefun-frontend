/* EXSALA HERMES MOD · powered by Gienetic */
/* Data layer for the make.fun public API (CORS-open, GET only).
   - In-memory cache: path -> { at, data | promise }, TTL 30s
   - Stale-while-revalidate: a stale hit returns cached data immediately
     and refreshes in the background
   - Concurrent calls to the same path share one in-flight fetch
*/

export const API = 'https://make.fun/api';

const TTL = 30_000;

/** @type {Map<string, {at: number, data?: any, promise?: Promise<any>}>} */
const cache = new Map();

/** Raw network call. Throws with the HTTP status on !ok. */
async function request(path) {
  const res = await fetch(API + path, {
    method: 'GET',
    mode: 'cors',
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    const err = new Error(`Request failed (${res.status}) for ${path}`);
    err.status = res.status;
    err.path = path;
    throw err;
  }

  return res.json();
}

/** Start (or join) the single in-flight fetch for a path. */
function revalidate(path) {
  const prev = cache.get(path);
  if (prev && prev.promise) return prev.promise;

  const keepData = prev && prev.data !== undefined ? prev.data : undefined;
  const keepAt = prev ? prev.at : 0;

  const promise = request(path).then(
    (data) => {
      cache.set(path, { at: Date.now(), data });
      return data;
    },
    (err) => {
      // Drop the in-flight marker; keep stale data if we had any.
      if (keepData !== undefined) cache.set(path, { at: keepAt, data: keepData });
      else cache.delete(path);
      throw err;
    }
  );

  const entry = { at: keepAt, promise };
  if (keepData !== undefined) entry.data = keepData;
  cache.set(path, entry);

  return promise;
}

/** Cached GET. Resolves with parsed JSON. */
export async function get(path) {
  const entry = cache.get(path);

  if (entry) {
    if (entry.promise) return entry.promise;                 // share in-flight fetch
    if (Date.now() - entry.at < TTL) return entry.data;      // fresh hit
    revalidate(path).catch(() => {});                        // stale: refresh silently
    return entry.data;                                        // ...and serve now
  }

  return revalidate(path);
}

/** Drop everything (used by the retry path). */
export function clearCache() {
  cache.clear();
}

export function getBounties() {
  return get('/competitions?status=open&activity=times');
}

export function getBounty(slug) {
  return get(`/competitions/${encodeURIComponent(slug)}`);
}

export function getLeaderboard(slug) {
  return get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);
}

export function getProfile(handle) {
  return get(`/profiles/${encodeURIComponent(handle)}`);
}

export default {
  API,
  get,
  clearCache,
  getBounties,
  getBounty,
  getLeaderboard,
  getProfile,
};
