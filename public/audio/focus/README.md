# Attention nudge clips

Short audio played when the vision guard catches the student looking away for
5 seconds while the avatar is explaining. Playback logic lives in
`src/attentionAudio.js`.

## Generating them

The English clips are **generated from Azure TTS** so the warnings come in the
teacher's own voice. Re-run after changing the wording or voice:

```
python backend/generate_focus_clips.py
```

That script holds the four escalating scripts and the Azure speaking style used
for each (`friendly` → default → `unfriendly` → `angry`). It overwrites in place.

## Layout

```
public/audio/focus/
  en/  female/  focus-1.mp3 … focus-4.mp3     ← en-US-AriaNeural
       male/    focus-1.mp3 … focus-4.mp3     ← en-US-GuyNeural
       focus-1.mp3 … focus-4.mp3              ← female copy, generic fallback
  hi/  …
```

The folder name is the **primary subtag of the teaching language** — the part of
`sttCode` in `src/languages.js` before the dash:

| Language  | Folder | Language  | Folder |
|-----------|--------|-----------|--------|
| English   | `en`   | Marathi   | `mr`   |
| Hindi     | `hi`   | Bengali   | `bn`   |
| Kannada   | `kn`   | Gujarati  | `gu`   |
| Tamil     | `ta`   | Punjabi   | `pa`   |
| Telugu    | `te`   | Urdu      | `ur`   |
| Malayalam | `ml`   | Odia      | `or`   |
|           |        | Assamese  | `as`   |

## Fallback chain

For nudge *N*, language *L*, avatar gender *G*, the player tries in order:

1. `L/G/focus-N.mp3`
2. `L/focus-N.mp3`
3. `en/G/focus-N.mp3`
4. `en/focus-N.mp3`
5. `en/G/focus-1.mp3`, `en/focus-1.mp3`
6. a generated two-tone chime (no asset required)

So a language with no clips of its own falls back to the English teacher voice,
and a fresh checkout with no MP3s at all still works — you just get the chime.

## The escalation ladder

Clip N is chosen by how many times the guard has fired this session, rotating
1 → 2 → 3 → 4 → 1. Each step is firmer, so a student who keeps drifting hears a
progressively stricter teacher instead of the same line on a loop:

| # | Azure style  | Line |
|---|--------------|------|
| 1 | `friendly`   | "I noticed you looked away. Please focus on the learning, and we can continue." |
| 2 | *(default)*  | "Your attention is drifting again. Please keep your eyes on the lesson." |
| 3 | `unfriendly` | "That is the third time you have looked away. You need to concentrate now." |
| 4 | `angry`      | "You keep losing focus. Pay attention to the lesson, or we cannot make any progress." |

## Adding another language

Add the language to `VOICES`/`CLIPS` in `backend/generate_focus_clips.py` with
its translated lines and an Azure voice from `src/languages.js`, then re-run the
script. Hand-recorded MP3s dropped into the right folder work equally well —
mono, ~96 kbps, normalised to roughly the avatar's own loudness.
