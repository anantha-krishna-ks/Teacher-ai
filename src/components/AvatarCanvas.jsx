import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';
import { apiUrl, ENDPOINTS } from '../config';
import { azureVoiceFor } from '../languages';
import { fetchTtsJson } from '../ttsCache';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const AvatarCanvas = forwardRef(({ textToSpeak, gender = "female", accent = "US", language = "English", modelUrl, isPaused, onSubtitleWord, onSpeechEnd, onSpeechStart }, ref) => {
  const containerRef = useRef(null);
  const headRef = useRef(null);
  const wordIndexRef = useRef(-1);
  const cachedAudioDataRef = useRef(null);
  const readyRef = useRef(false);            // true once the 3D avatar has finished loading
  const lastSpokenTextRef = useRef("");
  const speakGenRef = useRef(0);             // increments per utterance to detect interruptions

  const onSubtitleWordRef = useRef(onSubtitleWord);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onSpeechStartRef = useRef(onSpeechStart);
  useEffect(() => {
    onSubtitleWordRef.current = onSubtitleWord;
    onSpeechEndRef.current = onSpeechEnd;
    onSpeechStartRef.current = onSpeechStart;
  }, [onSubtitleWord, onSpeechEnd, onSpeechStart]);

  // Mirror the latest prop values so the stable speak() reads current settings at call time.
  const latestRef = useRef({ textToSpeak, gender, accent, language, isPaused });
  latestRef.current = { textToSpeak, gender, accent, language, isPaused };

  useImperativeHandle(ref, () => ({
    seekToTime: async (offsetMs) => {
      if (!cachedAudioDataRef.current || !headRef.current) return;
      const { decodedBuffer, words, wtimes, wdurations, voiceName, ttsLangCode, lipSyncCode } = cachedAudioDataRef.current;
      headRef.current.stopSpeaking();
      const audioCtx = headRef.current.audioCtx;
      const startSample = Math.floor((offsetMs / 1000) * decodedBuffer.sampleRate);
      const endSample = decodedBuffer.length;
      if (startSample >= endSample || startSample < 0) return;
      const length = endSample - startSample;
      const newBuffer = audioCtx.createBuffer(decodedBuffer.numberOfChannels, length, decodedBuffer.sampleRate);
      for (let channel = 0; channel < decodedBuffer.numberOfChannels; channel++) {
        const channelData = decodedBuffer.getChannelData(channel);
        const newChannelData = newBuffer.getChannelData(channel);
        newChannelData.set(channelData.subarray(startSample, endSample));
      }
      const newWords = [], newWTimes = [], newWDurations = [];
      let firstWordIndex = -1;
      for (let i = 0; i < wtimes.length; i++) {
        if (wtimes[i] + wdurations[i] >= offsetMs) {
          if (firstWordIndex === -1) firstWordIndex = i;
          newWords.push("bla");
          newWTimes.push(Math.max(0, wtimes[i] - offsetMs));
          const wordEnd = wtimes[i] + wdurations[i];
          newWDurations.push(wordEnd - Math.max(offsetMs, wtimes[i]));
        }
      }
      if (firstWordIndex === -1) return;
      wordIndexRef.current = firstWordIndex - 1;
      await headRef.current.speakAudio({ audio: newBuffer, words: newWords, wtimes: newWTimes, wdurations: newWDurations },
        { ttsVoice: voiceName, ttsLang: ttsLangCode, lipsyncLang: lipSyncCode },
        (sub) => {
          wordIndexRef.current += 1;
          if (onSubtitleWordRef.current) {
            const realWord = words[wordIndexRef.current] || "";
            onSubtitleWordRef.current(realWord.trim(), wordIndexRef.current);
          }
        });
      if (latestRef.current.isPaused) headRef.current.stop();
    },
    getCurrentTimeMs: () => {
      if (!cachedAudioDataRef.current || wordIndexRef.current < 0) return 0;
      const { wtimes, wdurations } = cachedAudioDataRef.current;
      if (wordIndexRef.current >= wtimes.length) {
        const lastIdx = wtimes.length - 1;
        return wtimes[lastIdx] + wdurations[lastIdx];
      }
      return wtimes[wordIndexRef.current];
    },
    getTotalDurationMs: () => {
      if (!cachedAudioDataRef.current) return 0;
      const { decodedBuffer } = cachedAudioDataRef.current;
      return (decodedBuffer.length / decodedBuffer.sampleRate) * 1000;
    }
  }));

  const activeModelUrl = modelUrl || "/brunette.glb";

  // ── Core speak routine (stable identity; reads voice settings from latestRef) ──
  const speak = useCallback(async (text) => {
    const myGen = ++speakGenRef.current;
    console.log("[AvatarCanvas] speak routine invoked. Text length:", text.length, "content:", text);
    try {
      if (!headRef.current || !headRef.current.avatar) {
        console.warn("[AvatarCanvas] speak aborted: headRef or avatar is not ready.");
        return;
      }
      // Browsers start the AudioContext suspended until a user gesture — make sure
      // it's running or the speech animates silently (lip-sync but no sound).
      const ctx = headRef.current.audioCtx;
      if (ctx && ctx.state === 'suspended') {
        console.log("[AvatarCanvas] AudioContext is suspended. Attempting to resume...");
        try { await ctx.resume(); } catch (e) { console.warn("Failed to resume ctx inside speak:", e); }
      }
      const { gender, accent, language } = latestRef.current;
      headRef.current.stopSpeaking();
      wordIndexRef.current = -1;

      // Azure Neural voice for the chosen language (English honours the US/IN accent).
      // lipSyncCode stays "en": TalkingHead's viseme mapping is English-based here.
      const { voiceName, ttsLangCode } = azureVoiceFor(language, gender, accent);
      const lipSyncCode = "en";

      // Reads through the TTS cache: an utterance that was prefetched (e.g. the
      // chapter orientation briefing, downloaded while the orientation card was
      // loading) resolves instantly instead of waiting on the network.
      console.log("[AvatarCanvas] Resolving azure-tts voice:", voiceName, "(cached if prefetched)");
      const data = await fetchTtsJson(text, voiceName);
      console.log("[AvatarCanvas] Have azure-tts audio. Decoding audio buffer...");
      const binary = atob(data.audioContent);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const decodedBuffer = await headRef.current.audioCtx.decodeAudioData(array.buffer);
      const dummyWords = data.words.map(() => "bla");
      cachedAudioDataRef.current = { decodedBuffer, words: data.words, wtimes: data.wtimes, wdurations: data.wdurations, voiceName, ttsLangCode, lipSyncCode };
      console.log("[AvatarCanvas] Audio decoded. Speaking audio via TalkingHead...");

      // Bail if this utterance was superseded (Live turned off, or a newer utterance
      // started) during the TTS fetch/decode — never queue stale audio.
      if (speakGenRef.current !== myGen || !headRef.current) return;

      if (onSpeechStartRef.current) {
        onSpeechStartRef.current(text);
      }

      const isPrepMessage =
        text === "I am preparing to explain this page for you. Please give me a moment." ||
        text === "I am preparing some quiz questions based on this page. Get ready to test your understanding!";
      if (!isPrepMessage) {
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      // Re-check after the delay — a stop/supersede may have landed during it.
      if (speakGenRef.current !== myGen || !headRef.current) return;

      headRef.current.speakAudio({ audio: decodedBuffer, words: dummyWords, wtimes: data.wtimes, wdurations: data.wdurations },
        { ttsVoice: voiceName, ttsLang: ttsLangCode, lipsyncLang: lipSyncCode },
        (sub) => {
          wordIndexRef.current += 1;
          if (onSubtitleWordRef.current) {
            const realWord = data.words[wordIndexRef.current] || "";
            onSubtitleWordRef.current(realWord.trim(), wordIndexRef.current);
          }
        });

      // speakAudio only QUEUES the audio (it isn't awaitable), so wait for TalkingHead to
      // actually finish this utterance by watching its `isSpeaking` flag. This is the
      // reliable end-of-speech signal that drives the Live turn-taking loop. The deadline
      // is frozen while paused so pausing mid-answer never drops the end signal.
      const audioMs = (decodedBuffer.length / decodedBuffer.sampleRate) * 1000;
      await new Promise((resolve) => {
        let sawSpeaking = false;
        let elapsed = 0;
        let last = performance.now();
        const iv = setInterval(() => {
          const now = performance.now();
          const paused = !!latestRef.current.isPaused;
          if (!paused) elapsed += now - last;
          last = now;
          const mineStill = speakGenRef.current === myGen && !!headRef.current;
          const speaking = !!headRef.current?.isSpeaking;
          if (speaking) sawSpeaking = true;
          const timedOut = elapsed > audioMs + 3000;
          if (!mineStill || (!paused && sawSpeaking && !speaking) || timedOut) {
            clearInterval(iv);
            resolve();
          }
        }, 120);
      });

      // Signal end-of-speech only if this utterance wasn't superseded or paused.
      if (speakGenRef.current === myGen && !latestRef.current.isPaused && onSpeechEndRef.current) {
        onSpeechEndRef.current();
      }
    } catch (err) {
      console.error("[AvatarCanvas] Error in speak:", err);
      if (onSpeechStartRef.current) {
        onSpeechStartRef.current(text, true);
      }
      // Allow a retry of this text (e.g. transient TTS failure)
      if (lastSpokenTextRef.current === text) lastSpokenTextRef.current = "";
      // Signal end-of-speech so the Live loop resumes listening after a failed TTS
      // instead of stalling permanently (only if still current & not paused).
      if (speakGenRef.current === myGen && !latestRef.current.isPaused && onSpeechEndRef.current) {
        onSpeechEndRef.current();
      }
    }
  }, []);

  // Speak the current text if — and as soon as — the avatar is ready and it hasn't been spoken yet.
  const maybeSpeak = useCallback(() => {
    const { textToSpeak, isPaused } = latestRef.current;
    readyRef.current = true;
    console.log("[AvatarCanvas] maybeSpeak triggered:", {
      textToSpeak,
      isPaused,
      ready: readyRef.current,
      head: !!headRef.current,
      avatar: headRef.current ? !!headRef.current.avatar : false,
      lastSpoken: lastSpokenTextRef.current
    });
    if (!readyRef.current || !headRef.current || !headRef.current.avatar) return;

    // Clear playback immediately if textToSpeak is cleared
    if (!textToSpeak) {
      console.log("[AvatarCanvas] textToSpeak is empty. Stopping speech.");
      speakGenRef.current++; // supersede any in-flight utterance so it won't fire onSpeechEnd
      headRef.current.stopSpeaking();
      lastSpokenTextRef.current = "";
      return;
    }

    if (isPaused) return;

    // If the AudioContext is suspended, try to resume it right now. Entering the
    // classroom is itself a user click (sticky activation), so this normally succeeds
    // and the greeting speaks immediately — no extra interaction needed. If it can't
    // resume (no activation yet), stay deferred and the unlock handler will retry.
    const ctx = headRef.current.audioCtx;
    if (ctx && ctx.state === 'suspended') {
      console.log("[AvatarCanvas] AudioContext suspended — attempting resume to speak greeting.");
      ctx.resume()
        .then(() => { if (ctx.state === 'running') maybeSpeak(); })
        .catch(() => { /* stay deferred; pointerdown/keydown unlock will retry */ });
      return;
    }

    if (textToSpeak === lastSpokenTextRef.current) return;
    lastSpokenTextRef.current = textToSpeak;
    speak(textToSpeak);
  }, [speak]);

  // ── Unlock audio on the first user interaction (autoplay policy) ──
  // Must NOT fight an intentional pause: if the user paused, leave the context suspended.
  useEffect(() => {
    const unlock = () => {
      if (latestRef.current.isPaused) return;
      const ctx = headRef.current?.audioCtx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume()
          .then(() => {
            console.log("[AvatarCanvas] AudioContext resumed by user interaction. Retrying speak...");
            maybeSpeak();
          })
          .catch((e) => {
            console.warn("[AvatarCanvas] Failed to resume AudioContext on user interaction:", e);
          });
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [maybeSpeak]);

  // ── Returning to the tab must not auto-resume audio that was paused ──
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && latestRef.current.isPaused && headRef.current) {
        headRef.current.stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ── Pause / resume ──
  useEffect(() => {
    if (headRef.current) {
      if (isPaused) headRef.current.stop();
      else headRef.current.start();
    }
  }, [isPaused]);

  // ── Load the 3D avatar ──
  useEffect(() => {
    if (!containerRef.current || !activeModelUrl) return;
    readyRef.current = false;
    Object.defineProperty(GLTFLoader.prototype, 'meshoptDecoder', {
      get: function () { return this._meshoptDecoder || MeshoptDecoder; },
      set: function (val) { if (val !== null) this._meshoptDecoder = val; },
      configurable: true
    });
    containerRef.current.innerHTML = "";
    const initAvatar = async () => {
      try {
        const head = new TalkingHead(containerRef.current, {
          showFrameRate: false,
          cameraView: "head",
          lipsyncModules: ["en"],
          ttsEndpoint: apiUrl(ENDPOINTS.azureTts),
          modelRoot: "Armature",
        });
        headRef.current = head;
        if (head.audioCtx) {
          head.audioCtx.resume().catch((e) => {
            console.warn("Failed to resume AudioContext synchronously:", e);
          });
        }
        await head.showAvatar({ url: activeModelUrl }, (progress) => {
          console.log(`Loading 3D Avatar: ${Math.round(progress * 100)}%`);
        });
        if (headRef.current.avatar) {
          headRef.current.avatar.scale.set(0.85, 0.85, 0.85);
          headRef.current.avatar.position.set(0, -1.2, 0);
        }
        readyRef.current = true;
        // Speak any greeting/text that was set before the avatar finished loading.
        maybeSpeak();
      } catch (error) {
        console.error("Error loading talking head:", error);
      }
    };
    initAvatar();
    return () => {
      readyRef.current = false;
      if (headRef.current) { headRef.current.stop(); headRef.current = null; }
    };
  }, [activeModelUrl, maybeSpeak]);

  // ── Speak whenever the text (or voice settings) change ──
  useEffect(() => {
    maybeSpeak();
  }, [textToSpeak, gender, accent, language, maybeSpeak]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', borderRadius: '20px', overflow: 'hidden' }} />
  );
});

export default AvatarCanvas;
