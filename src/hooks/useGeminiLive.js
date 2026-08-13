import { useRef, useCallback } from 'react';
import { wsUrl, ENDPOINTS } from '../config';

/**
 * useGeminiLive — real-time voice bridge for LIVE Interact mode.
 *
 * Captures the browser microphone (16 kHz PCM via an AudioWorklet), streams it to
 * the FastAPI `/api/avatar/live` WebSocket (which proxies Gemini Live), and pipes
 * the returned 24 kHz voice audio + transcript into the TalkingHead avatar.
 *
 * The avatar plays audio and lip-syncs via `avatarRef`'s streaming methods
 * (startLiveStream / feedLiveAudio / feedLiveWords / interruptLiveStream / stopLiveStream).
 *
 * Callbacks let App.jsx drive the chat + status UI:
 *   onStatus(state)        'connecting' | 'listening' | 'speaking' | 'stopped' | 'error'
 *   onUserInterim(text)    live (partial) transcript of what the student is saying
 *   onUserFinal(text)      committed student utterance for a completed exchange
 *   onBotFinal(text)       committed avatar reply for a completed exchange
 *   onError(message)
 */
export default function useGeminiLive({
  avatarRef,
  onStatus = () => {},
  onUserInterim = () => {},
  onUserFinal = () => {},
  onBotFinal = () => {},
  onError = () => {},
}) {
  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const nodeRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);

  // Accumulators for the in-progress exchange.
  const userAccRef = useRef("");
  const botAccRef = useRef("");

  const cleanupAudio = useCallback(() => {
    try { nodeRef.current?.disconnect(); } catch (_) {}
    try { sourceRef.current?.disconnect(); } catch (_) {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { ctxRef.current?.close(); } catch (_) {}
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      }
    } catch (_) {}
    try { wsRef.current?.close(); } catch (_) {}
    wsRef.current = null;
    cleanupAudio();
    try { avatarRef.current?.stopLiveStream(); } catch (_) {}
    userAccRef.current = "";
    botAccRef.current = "";
    onStatus("stopped");
  }, [avatarRef, cleanupAudio, onStatus]);

  const startMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,   // reduce the avatar's voice bleeding back in
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 16000 });
    ctxRef.current = ctx;
    await ctx.audioWorklet.addModule('/capture-worklet.js');

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'capture-worklet');
    node.port.onmessage = (e) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data); // ArrayBuffer of 16-bit PCM
      }
    };
    source.connect(node);
    // Intentionally NOT connected to ctx.destination — we don't want to hear the mic.
    sourceRef.current = source;
    nodeRef.current = node;
  }, []);

  const start = useCallback(async ({ bookId, pageNumber, gender, language }) => {
    if (runningRef.current) return;
    runningRef.current = true;
    userAccRef.current = "";
    botAccRef.current = "";
    onStatus("connecting");

    const ws = new WebSocket(wsUrl(ENDPOINTS.live));
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "start",
        book_id: bookId,
        page_number: pageNumber,
        gender,
        language,
      }));
    };

    ws.onmessage = async (ev) => {
      // Binary => avatar audio.
      if (ev.data instanceof ArrayBuffer) {
        avatarRef.current?.feedLiveAudio(ev.data);
        return;
      }
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }

      switch (msg.type) {
        case "ready":
          try {
            await avatarRef.current?.startLiveStream();
            await startMic();
            onStatus("listening");
          } catch (err) {
            onError("Microphone/avatar init failed: " + err.message);
            stop();
          }
          break;

        case "input_transcription":
          userAccRef.current += msg.text;
          onUserInterim(userAccRef.current.trim());
          onStatus("listening");
          break;

        case "output_transcription":
          botAccRef.current += msg.text;
          avatarRef.current?.feedLiveWords(msg.text); // drive the mouth
          onStatus("speaking");
          break;

        case "interrupted":
          avatarRef.current?.interruptLiveStream();
          break;

        case "turn_complete": {
          const u = userAccRef.current.trim();
          const b = botAccRef.current.trim();
          if (u) onUserFinal(u);
          if (b) onBotFinal(b);
          userAccRef.current = "";
          botAccRef.current = "";
          onUserInterim("");
          break;
        }

        case "error":
          onError(msg.message || "Live session error");
          stop();
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      if (runningRef.current) onError("WebSocket connection error");
    };

    ws.onclose = () => {
      if (runningRef.current) {
        // Unexpected close while still running.
        runningRef.current = false;
        cleanupAudio();
        try { avatarRef.current?.stopLiveStream(); } catch (_) {}
        onStatus("stopped");
      }
    };
  }, [avatarRef, startMic, stop, cleanupAudio, onStatus, onUserInterim, onUserFinal, onBotFinal, onError]);

  return { start, stop };
}
