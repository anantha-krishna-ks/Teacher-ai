import { useRef, useEffect, useCallback } from 'react';
import { wsUrl, ENDPOINTS } from '../config';

/**
 * useTeacherLive — VOICE-ONLY "Ask the Teacher" bridge (Gemini Live, no 3D avatar).
 *
 * Captures the browser mic (16 kHz PCM via an AudioWorklet), streams it to the
 * FastAPI `/api/avatar/live` WebSocket, and plays the teacher's 24 kHz voice back
 * directly with the Web Audio API (scheduled PCM chunks — no TalkingHead, no lip-sync).
 *
 * `start`/`stop` are STABLE (callbacks read via a ref) so passing inline arrow
 * functions from the component does not tear down the socket on every render.
 *
 * Options:
 *   onStatus(state)      'connecting' | 'listening' | 'speaking' | 'stopped' | 'error'
 *   onUserInterim(text)  live partial transcript of the student
 *   onUserFinal(text)    committed student utterance
 *   onBotFinal(text)     committed teacher reply
 *   onEnded(reason)      server auto-stopped the session ('idle' | 'max_duration')
 *   onError(message)
 */
export default function useTeacherLive(options) {
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const mutedRef = useRef(false);
  const heldRef = useRef(false);   // call on hold: pause mic send + teacher audio, pause server idle timer

  // Mic capture graph
  const micCtxRef = useRef(null);
  const micNodeRef = useRef(null);
  const micSrcRef = useRef(null);
  const micStreamRef = useRef(null);

  // Playback graph (24 kHz PCM scheduled sequentially)
  const playCtxRef = useRef(null);
  const nextTimeRef = useRef(0);
  const sourcesRef = useRef([]);

  const userAccRef = useRef("");
  const botAccRef = useRef("");

  const emitStatus = (s) => optsRef.current.onStatus?.(s);

  // ── Playback helpers ──────────────────────────────────────────────────────
  const ensurePlayCtx = () => {
    if (!playCtxRef.current) {
      playCtxRef.current = new AudioContext();
      nextTimeRef.current = playCtxRef.current.currentTime;
    }
    return playCtxRef.current;
  };

  const playChunk = (arrayBuffer) => {
    if (heldRef.current) return;   // call on hold — drop teacher audio
    const ctx = ensurePlayCtx();
    const int16 = new Int16Array(arrayBuffer);
    if (!int16.length) return;
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 32768;
    const buf = ctx.createBuffer(1, float.length, 24000); // Gemini output rate
    buf.getChannelData(0).set(float);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextTimeRef.current);
    src.start(startAt);
    nextTimeRef.current = startAt + buf.duration;
    sourcesRef.current.push(src);
    src.onended = () => { sourcesRef.current = sourcesRef.current.filter(s => s !== src); };
  };

  const flushPlayback = () => {
    for (const s of sourcesRef.current) { try { s.stop(); } catch (_) {} }
    sourcesRef.current = [];
    if (playCtxRef.current) nextTimeRef.current = playCtxRef.current.currentTime;
  };

  // ── Teardown ──────────────────────────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
    flushPlayback();
    try { micNodeRef.current?.disconnect(); } catch (_) {}
    try { micSrcRef.current?.disconnect(); } catch (_) {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { micCtxRef.current?.close(); } catch (_) {}
    try { playCtxRef.current?.close(); } catch (_) {}
    micNodeRef.current = null;
    micSrcRef.current = null;
    micStreamRef.current = null;
    micCtxRef.current = null;
    playCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!runningRef.current && !wsRef.current) return;
    runningRef.current = false;
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      }
    } catch (_) {}
    try { wsRef.current?.close(); } catch (_) {}
    wsRef.current = null;
    cleanupAudio();
    userAccRef.current = "";
    botAccRef.current = "";
    emitStatus("stopped");
  }, [cleanupAudio]);

  // ── Mic ───────────────────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStreamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 16000 });
    micCtxRef.current = ctx;
    await ctx.audioWorklet.addModule('/capture-worklet.js');

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'capture-worklet');
    node.port.onmessage = (e) => {
      if (mutedRef.current || heldRef.current) return; // muted or on hold — don't send mic audio
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(e.data);
    };
    source.connect(node);
    micSrcRef.current = source;
    micNodeRef.current = node;
  }, []);

  // ── Start a session ─────────────────────────────────────────────────────────
  const start = useCallback(async ({ bookId, pageNumber, gender, language }) => {
    if (runningRef.current) return;
    runningRef.current = true;
    userAccRef.current = "";
    botAccRef.current = "";
    emitStatus("connecting");

    const ws = new WebSocket(wsUrl(ENDPOINTS.live));
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    const thisWs = ws; // guard: ignore events from a superseded socket (React StrictMode double-mount)

    ws.onopen = () => {
      if (wsRef.current !== thisWs) return;
      ws.send(JSON.stringify({ type: "start", book_id: bookId, page_number: pageNumber, gender, language }));
    };

    ws.onmessage = async (ev) => {
      if (wsRef.current !== thisWs) return;
      if (ev.data instanceof ArrayBuffer) {
        playChunk(ev.data);
        return;
      }
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      const o = optsRef.current;

      switch (msg.type) {
        case "ready":
          try {
            await startMic();
            emitStatus("listening");
          } catch (err) {
            o.onError?.("Microphone access failed: " + err.message);
            stop();
          }
          break;
        case "input_transcription":
          userAccRef.current += msg.text;
          o.onUserInterim?.(userAccRef.current.trim());
          emitStatus("listening");
          break;
        case "output_transcription":
          botAccRef.current += msg.text;
          o.onBotInterim?.(botAccRef.current.trim());
          emitStatus("speaking");
          break;
        case "interrupted":
          flushPlayback();
          break;
        case "turn_complete": {
          const u = userAccRef.current.trim();
          const b = botAccRef.current.trim();
          if (u) o.onUserFinal?.(u);
          if (b) o.onBotFinal?.(b);
          userAccRef.current = "";
          botAccRef.current = "";
          o.onUserInterim?.("");
          break;
        }
        case "session_ended":
          o.onEnded?.(msg.reason || "ended");
          stop();
          break;
        case "error":
          o.onError?.(msg.message || "Live session error");
          stop();
          break;
        default:
          break;
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== thisWs) return; // superseded socket — not a real error
      if (runningRef.current) optsRef.current.onError?.("WebSocket connection error");
    };

    ws.onclose = () => {
      if (wsRef.current !== thisWs) return; // superseded socket — ignore
      if (runningRef.current) {
        runningRef.current = false;
        cleanupAudio();
        emitStatus("stopped");
      }
    };
  }, [startMic, stop, cleanupAudio]);

  const setMuted = useCallback((m) => { mutedRef.current = !!m; }, []);

  // Hold/resume the call: pause the mic + teacher audio locally, and tell the server
  // to pause its idle-timeout watchdog so the call doesn't auto-hang-up while held.
  const setHold = useCallback((h) => {
    heldRef.current = !!h;
    if (h) flushPlayback();   // stop any teacher audio already playing
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: h ? "hold" : "resume" }));
    } catch (_) {}
  }, []);

  // Safety: stop on unmount.
  useEffect(() => () => { stop(); }, [stop]);

  return { start, stop, setMuted, setHold };
}
