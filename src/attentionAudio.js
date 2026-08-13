// ────────────────────────────────────────────────────────────────────────────
// Attention nudge audio — the "Please focus on the learning…" clips played when
// the vision guard catches the student looking away.
//
// Deliberately plays through a plain <Audio> element and NOT through the avatar
// (TalkingHead). Routing it via the avatar would fight the AudioContext we just
// suspended to pause the lesson, and it would drive lipsync + fire onSpeechEnd,
// which would corrupt the lesson state machine.
//
// Clips live in:  public/audio/focus/<lang>/focus-1.mp3 … focus-4.mp3
// where <lang> is the primary subtag of the teaching language ("en", "hi", "kn"…).
// Missing language folder  -> falls back to "en".
// Missing "en" clip too    -> falls back to a generated two-tone chime, so the
//                             feature always works even before any MP3 is recorded.
// ────────────────────────────────────────────────────────────────────────────

import { sttCodeFor } from './languages';

// How many clips a language folder may hold. The nudge rotates through them so a
// student who keeps drifting doesn't hear the same line over and over — and the
// later clips can be recorded in a firmer tone (gentle → firm).
const CLIP_COUNT = 4;

let currentAudio = null;   // the clip playing right now (so we can cut it short)
let nudgeIndex = 0;        // rotates 0,1,2,3,0,… across the whole session
let audioCtx = null;       // lazily created, only for the fallback chime

/** Primary language subtag used as the clip folder name: "Hindi" -> "hi". */
function langFolder(language) {
  return (sttCodeFor(language) || 'en-US').split('-')[0].toLowerCase();
}

/** Stop whatever nudge is playing (student clicked Resume before it finished). */
export function stopNudge() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (_) {}
    currentAudio = null;
  }
}

/**
 * Try one file. Resolves once playback actually starts; rejects on a 404, an
 * unsupported file, or an autoplay block — the caller then tries the next source.
 */
function playFile(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = 1.0;
    currentAudio = audio;
    audio.play().then(() => resolve(src)).catch(reject);
  });
}

/**
 * Last-resort nudge: a short descending two-tone chime built with WebAudio.
 * No asset needed, so the guard is never silent — even on a fresh checkout with
 * no MP3s recorded yet.
 */
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const now = audioCtx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.22;
      // Short envelope — a soft ping, not a harsh beep.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  } catch (_) {
    // Audio is a nicety here; the blocking overlay is what actually stops the lesson.
  }
}

/**
 * Play the next attention nudge, in the voice of the avatar currently teaching.
 *
 * Clips ESCALATE: 1 is a gentle reminder, 4 is a strict telling-off. The index
 * advances on every trigger, so a student who keeps drifting gets a progressively
 * firmer teacher rather than the same line on a loop.
 *
 * Cuts off any nudge still playing, then walks the fallback chain:
 *   <lang>/<gender>/focus-N.mp3
 *   <lang>/focus-N.mp3
 *   en/<gender>/focus-N.mp3
 *   en/focus-N.mp3
 *   en/focus-1.mp3
 *   generated chime
 */
export async function playAttentionNudge(language = 'English', gender = 'female', clipNumber = null) {
  stopNudge();

  // The caller normally passes the strike number so the spoken warning always
  // matches the count shown on screen (strike 3 -> clip 3). Falling back to the
  // internal rotation keeps the function usable on its own.
  let n;
  if (clipNumber) {
    n = ((clipNumber - 1) % CLIP_COUNT) + 1;
  } else {
    n = (nudgeIndex % CLIP_COUNT) + 1;
    nudgeIndex += 1;
  }

  const folder = langFolder(language);
  const g = gender === 'male' ? 'male' : 'female';

  const candidates = [
    `/audio/focus/${folder}/${g}/focus-${n}.mp3`,
    `/audio/focus/${folder}/focus-${n}.mp3`,
  ];
  if (folder !== 'en') {
    candidates.push(`/audio/focus/en/${g}/focus-${n}.mp3`, `/audio/focus/en/focus-${n}.mp3`);
  }
  // Clip N may not exist yet even though clip 1 does — always try clip 1 too.
  if (n !== 1) candidates.push(`/audio/focus/en/${g}/focus-1.mp3`, '/audio/focus/en/focus-1.mp3');

  for (const src of candidates) {
    try {
      await playFile(src);
      return;
    } catch (_) {
      currentAudio = null;
    }
  }
  playChime();
}

/** Reset the rotation — called when a new lesson starts. */
export function resetNudgeRotation() {
  nudgeIndex = 0;
}
