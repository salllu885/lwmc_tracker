// Field connectivity is unreliable, and a Surveyor/Rectifier standing right
// at the issue shouldn't lose a capture just because there's no signal —
// this lets them save the photo+GPS+form locally and it uploads itself once
// a connection comes back. Only genuine network failures get queued here;
// validation/permission errors (bad UC, outside the geofence, etc.) still
// surface immediately since queuing those would just delay an inevitable
// failure with no path to fix it.
//
// localStorage, not IndexedDB: queue depth is expected to be a handful of
// items at most (one field worker's offline stretch), well inside the
// ~5-10MB origin quota even with compressed photo dataURLs, and it needs no
// async setup to read/write.

const KEY = 'fit_offline_queue_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full/unavailable — nothing more we can do client-side.
  }
}

// `kind` distinguishes what `flushQueue` should call to replay the item —
// 'report' -> createReport, 'resolution' -> resolveReport.
export function enqueue(kind, payload) {
  const items = readAll();
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, payload, queuedAt: new Date().toISOString() };
  items.push(item);
  writeAll(items);
  return item;
}

export function listQueued() {
  return readAll();
}

export function removeQueued(id) {
  writeAll(readAll().filter((i) => i.id !== id));
}

export function queueCount() {
  return readAll().length;
}

// A failure counts as "queue it" only when it actually looks like a
// connectivity problem — offline flag, or the TypeError fetch/undici throws
// for a network-level failure (message text varies by engine/WebView).
export function isNetworkError(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed');
}

// Attempts every queued item in order via the given handlers, removing each
// on success and stopping at the first failure (later items are likely to
// fail the same way, e.g. still offline) rather than hammering the API.
export async function flushQueue(handlers) {
  const items = readAll();
  let flushed = 0;
  for (const item of items) {
    const handler = handlers[item.kind];
    if (!handler) continue;
    try {
      await handler(item.payload);
      removeQueued(item.id);
      flushed += 1;
    } catch (e) {
      if (isNetworkError(e)) break;
      // Non-network failure (e.g. now-invalid UC, or since resolved by
      // someone else) — drop it rather than retrying forever.
      removeQueued(item.id);
    }
  }
  return flushed;
}
