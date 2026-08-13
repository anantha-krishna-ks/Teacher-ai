// ── TTS prefetch cache ───────────────────────────────────────────────────────
// Azure TTS for a 30-45 second script takes a few seconds, which is fine while a
// loading card is on screen and awful the moment the student clicks a button. So
// any speech we can see coming (the chapter orientation briefing) is fetched
// AHEAD of time and parked here, keyed by text + voice.
//
// AvatarCanvas.speak() reads through fetchTtsJson(), so a prefetched utterance
// starts with zero network wait, and anything that wasn't prefetched behaves
// exactly as before.

import { apiUrl, ENDPOINTS } from './config';

// key -> { promise, ok }   (ok flips to true once the fetch resolves)
const cache = new Map();

// Prefetched scripts are long; a handful is plenty and keeps memory bounded.
const MAX_ENTRIES = 8;

const keyFor = (text, voiceName) => `${voiceName || ''}::${text || ''}`;

function trim() {
  while (cache.size > MAX_ENTRIES) {
    // Map preserves insertion order, so the first key is the oldest.
    cache.delete(cache.keys().next().value);
  }
}

async function requestTts(text, voiceName) {
  const res = await fetch(apiUrl(ENDPOINTS.azureTts), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { ssml: text },
      voice: { name: voiceName },
      audioConfig: { audioEncoding: 'OGG-OPUS' },
    }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.statusText}`);
  return res.json();
}

/**
 * Start fetching this utterance now and keep the result for later. Never throws —
 * resolves to true when the audio is cached and ready, false if it failed (the
 * caller can carry on; speak() will simply fetch it live).
 */
export function prefetchTts(text, voiceName) {
  if (!text || !voiceName) return Promise.resolve(false);
  const key = keyFor(text, voiceName);
  const hit = cache.get(key);
  if (hit) return hit.promise.then(() => true, () => false);

  const entry = { ok: false, promise: null };
  entry.promise = requestTts(text, voiceName).then(
    (data) => { entry.ok = true; return data; },
    (err) => { cache.delete(key); throw err; },   // let a failed prefetch be retried
  );
  cache.set(key, entry);
  trim();
  return entry.promise.then(() => true, () => false);
}

/**
 * The TTS payload for this utterance — instantly from the prefetch cache when it
 * is there, otherwise fetched now (and cached, so a replay is instant too).
 * Throws if the request fails, like the original inline fetch did.
 */
export function fetchTtsJson(text, voiceName) {
  const key = keyFor(text, voiceName);
  const hit = cache.get(key);
  if (hit) return hit.promise;
  return prefetchTts(text, voiceName).then(() => {
    const entry = cache.get(key);
    if (!entry) throw new Error('TTS failed');
    return entry.promise;
  });
}

/** True when this exact utterance is already downloaded and will play instantly. */
export function isTtsReady(text, voiceName) {
  return !!cache.get(keyFor(text, voiceName))?.ok;
}

/** Drop everything (e.g. on logout) so a new session doesn't hold old audio. */
export function clearTtsCache() {
  cache.clear();
}
