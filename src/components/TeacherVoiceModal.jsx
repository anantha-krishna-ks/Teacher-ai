import { useEffect, useRef, useState, useCallback } from 'react';
import useTeacherLive from '../hooks/useTeacherLive';

/**
 * TeacherVoiceModal — a PHONE-CALL style "Ask the Teacher" (voice-only Gemini Live).
 *
 * Flow: ring (2-3 rings) → connect → teacher greets → in-call screen (timer, mute,
 * end-call, live caption). No 3D avatar. Self-contained: opens the session after the
 * ring and closes it on unmount.
 *
 * Renders as a panel docked over the right (chat) pane — NOT a full-screen overlay —
 * so the student can keep reading the PDF in the left pane while on the call. The
 * parent (.right-pane) is position:relative and this fills it via position:absolute.
 */
export default function TeacherVoiceModal({ book, page, gender, language, onClose, onCallFinished }) {
  const [phase, setPhase] = useState('ringing');   // ringing|connecting|live|ended
  const [ended, setEnded] = useState(null);         // 'idle' | 'max_duration' | null
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [captionShown, setCaptionShown] = useState(''); // progressively revealed teacher words
  const captionTargetRef = useRef('');                  // full teacher text received so far
  const captionBoxRef = useRef(null);
  const [interim, setInterim] = useState('');       // live student words
  const [turns, setTurns] = useState([]);
  const [muted, setMutedState] = useState(false);
  const [held, setHeld] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const ringTimerRef = useRef(null);
  const ringCtxRef = useRef(null);
  const scrollRef = useRef(null);

  // Disconnect / Hangup sound using Web Audio API (3 short descending tones)
  const playHangupSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const t = ctx.currentTime;

      const burst = (startTime, dur = 0.12) => {
        [480, 620].forEach((f) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, startTime);
          g.gain.exponentialRampToValueAtTime(0.14, startTime + 0.01);
          g.gain.setValueAtTime(0.14, startTime + dur - 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
          o.start(startTime);
          o.stop(startTime + dur);
        });
      };

      burst(t, 0.12);
      burst(t + 0.18, 0.12);
      burst(t + 0.36, 0.20);
    } catch (_) {}
  }, []);

  const { start, stop, setMuted, setHold } = useTeacherLive({
    onStatus: (s) => {
      if (s === 'listening') { setPhase(p => (p === 'ended' ? p : 'live')); setSpeaking(false); }
      else if (s === 'speaking') { setPhase(p => (p === 'ended' ? p : 'live')); setSpeaking(true); }
      else if (s === 'connecting') setPhase(p => (p === 'ended' ? p : 'connecting'));
    },
    onUserInterim: setInterim,
    onUserFinal: (t) => { setInterim(''); setTurns(prev => [...prev, { role: 'user', text: t }]); },
    onBotInterim: (t) => { captionTargetRef.current = t; },
    onBotFinal: (t) => { captionTargetRef.current = t; setTurns(prev => [...prev, { role: 'bot', text: t }]); },
    onEnded: (reason) => {
      playHangupSound();
      setEnded(reason);
      setPhase('ended');
    },
    onError: (m) => setError(m),
  });

  const begin = useCallback(() => {
    setEnded(null); setError(''); setSeconds(0);
    captionTargetRef.current = ''; setCaptionShown('');
    if (!book) return;
    start({ bookId: book.book_id, pageNumber: page, gender, language });
  }, [book, page, gender, language, start]);

  // Typewriter: reveal the teacher's text progressively toward the received target,
  // so captions stream in "live" instead of dumping all at once. When a new turn's
  // text arrives (not a continuation of what's shown), it restarts smoothly.
  useEffect(() => {
    const iv = setInterval(() => {
      setCaptionShown((shown) => {
        const target = captionTargetRef.current;
        if (!target) return shown ? '' : shown;
        if (!target.startsWith(shown)) return target.slice(0, 1); // new turn -> restart
        if (shown.length >= target.length) return shown;          // caught up
        const remaining = target.length - shown.length;
        const step = Math.max(1, Math.ceil(remaining / 12));      // ease: faster when far behind
        return target.slice(0, shown.length + step);
      });
    }, 45);
    return () => clearInterval(iv);
  }, []);

  // Classic double-ring using the Web Audio API (2-3 rings), then connect.
  const playRing = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ringCtxRef.current = ctx;
      const burst = (t) => {
        [440, 480].forEach((f) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
          g.gain.setValueAtTime(0.11, t + 0.32);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
          o.start(t); o.stop(t + 0.45);
        });
      };
      const n = ctx.currentTime;
      burst(n); burst(n + 0.8); burst(n + 1.6);
    } catch (_) {}
  }, []);

  // Ring on mount, then start the live session.
  useEffect(() => {
    playRing();
    ringTimerRef.current = setTimeout(() => {
      setPhase('connecting');
      begin();
    }, 2400);
    return () => {
      clearTimeout(ringTimerRef.current);
      try { ringCtxRef.current?.close(); } catch (_) {}
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call timer.
  useEffect(() => {
    if (phase !== 'live') return;
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, showTranscript]);

  // Live-scroll the caption to follow the latest words.
  useEffect(() => {
    captionBoxRef.current?.scrollTo({ top: captionBoxRef.current.scrollHeight, behavior: 'smooth' });
  }, [captionShown, interim]);

  const endCall = () => {
    playHangupSound();
    stop();
    if (onCallFinished && turns.length > 0) {
      onCallFinished({
        turns,
        seconds,
        bookId: book?.book_id || '',
        bookTitle: book?.title || '',
        pageNumber: page || 1,
        language
      });
    }
    onClose();
  };
  const redial = () => { setTurns([]); setHeld(false); setPhase('connecting'); begin(); };
  const toggleMute = () => { const m = !muted; setMutedState(m); setMuted(m); };
  const toggleHold = () => { const h = !held; setHeld(h); setHold(h); };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const statusText =
    phase === 'ringing' ? 'Ringing…' :
    phase === 'connecting' ? 'Connecting…' :
    phase === 'ended' ? (ended === 'idle' ? 'Call ended — no reply for 30s' : 'Call ended') :
    held ? 'On hold — tap ▶ to resume' :
    speaking ? 'Teacher speaking…' : 'Listening… speak now';

  const liveLine =
    phase === 'ended' ? '' :
    (interim && !speaking) ? interim :
    captionShown;

  return (
    <div style={S.panel} role="dialog" aria-label="Teacher call">
      <style>{`@keyframes tvmPulse { 0% { transform: scale(1); opacity: 0.85; } 100% { transform: scale(1.35); opacity: 0; } }`}</style>

      {/* header */}
      <div style={S.top}>
        <div style={S.name}>AI Teacher</div>
        <div style={S.sub}>{book?.title ? `${book.title} · ` : ''}ask about this chapter</div>
        <div style={S.timer}>{phase === 'live' ? mmss : statusText}</div>
      </div>

      {/* body — orb, status, live caption, optional transcript */}
      <div style={S.middle}>
        <div style={S.orbWrap}>
          <div style={{ ...S.ring, ...(speaking ? S.ringSpeaking : phase === 'ringing' ? S.ringRinging : {}) }} />
          <div style={{ ...S.ring2, ...(speaking ? S.ringSpeaking : {}) }} />
          <div style={S.orb}>{gender === 'male' ? '👨‍🏫' : '👩‍🏫'}</div>
        </div>

        <div style={S.status}>{statusText}</div>

        <div style={S.caption} ref={captionBoxRef}>
          {error ? <span style={{ color: '#fca5a5' }}>⚠️ {error}</span> : (liveLine || (phase === 'live' && !speaking ? '🎤' : ''))}
        </div>

        {showTranscript && (
          <div style={S.transcript} ref={scrollRef}>
            {turns.length === 0 && <div style={S.hint}>No conversation yet.</div>}
            {turns.map((t, i) => (
              <div key={i} style={{ ...S.bubble, ...(t.role === 'user' ? S.user : S.bot) }}>
                <span style={S.who}>{t.role === 'user' ? 'You' : 'Teacher'}</span>{t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* controls */}
      <div style={S.bottom}>
        {phase === 'ended' ? (
          <div style={S.controls}>
            <button style={{ ...S.circleBtn, background: '#22c55e' }} onClick={redial} title="Call again">📞</button>
            <button style={{ ...S.circleBtn, background: '#64748b' }} onClick={endCall} title="Close">✕</button>
          </div>
        ) : (
          <div style={S.controls}>
            <button
              style={{ ...S.circleBtn, background: muted ? '#f59e0b' : 'rgba(255,255,255,0.16)', opacity: held ? 0.4 : 1 }}
              onClick={toggleMute}
              disabled={held}
              title={held ? 'Resume to unmute' : muted ? 'Unmute' : 'Mute'}
            >{muted ? '🔇' : '🎙'}</button>
            <button
              style={{ ...S.circleBtn, background: held ? '#22c55e' : 'rgba(255,255,255,0.16)' }}
              onClick={toggleHold}
              title={held ? 'Resume call' : 'Hold call'}
            >{held ? '▶' : '⏸'}</button>
            <button style={{ ...S.circleBtn, ...S.endBtn }} onClick={endCall} title="End call">📵</button>
            <button
              style={{ ...S.circleBtn, background: showTranscript ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)' }}
              onClick={() => setShowTranscript((v) => !v)}
              title="Transcript"
            >💬</button>
          </div>
        )}
        <div style={S.tip}>Use headphones · talk over the teacher to interrupt</div>
      </div>
    </div>
  );
}

const S = {
  // Fills the right (chat) pane — .right-pane is position:relative, this is absolute inset:0.
  panel: {
    position: 'absolute', inset: 0, zIndex: 30,
    borderRadius: 18, overflow: 'hidden',
    background: 'linear-gradient(160deg,#0f172a,#1e293b 60%,#334155)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
    color: '#fff', fontFamily: 'inherit',
    display: 'flex', flexDirection: 'column',
    padding: '22px 20px 18px',
  },
  top: { textAlign: 'center', flexShrink: 0 },
  name: { fontSize: 22, fontWeight: 700, letterSpacing: 0.3 },
  sub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  timer: { fontSize: 13, color: '#cbd5e1', marginTop: 8, fontVariantNumeric: 'tabular-nums' },
  // Middle region grows to fill the tall pane and scrolls if content overflows.
  middle: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, overflowY: 'auto', padding: '6px 0' },
  orbWrap: { position: 'relative', width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '4px 0' },
  orb: { width: 104, height: 104, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46, boxShadow: '0 8px 30px rgba(99,102,241,0.5)', zIndex: 2 },
  ring: { position: 'absolute', width: 130, height: 130, borderRadius: '50%', border: '2px solid rgba(139,92,246,0.4)' },
  ring2: { position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: '2px solid rgba(139,92,246,0.2)' },
  ringSpeaking: { border: '2px solid rgba(34,197,94,0.7)', animation: 'tvmPulse 1.1s ease-out infinite' },
  ringRinging: { border: '2px solid rgba(245,158,11,0.7)', animation: 'tvmPulse 0.9s ease-out infinite' },
  status: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginTop: 6, textAlign: 'center', flexShrink: 0 },
  caption: { width: '100%', minHeight: 40, maxHeight: 150, overflowY: 'auto', textAlign: 'center', fontSize: 15, lineHeight: 1.5, color: '#f1f5f9', margin: '8px 0', padding: '0 4px' },
  transcript: { width: '100%', maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: 12 },
  hint: { color: '#94a3b8', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  bubble: { padding: '6px 10px', borderRadius: 10, fontSize: 13, lineHeight: 1.4, maxWidth: '90%' },
  user: { alignSelf: 'flex-end', background: 'rgba(96,165,250,0.25)' },
  bot: { alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)' },
  who: { display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#94a3b8', marginBottom: 2 },
  bottom: { flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 10 },
  controls: { display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'center' },
  circleBtn: { width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 22, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  endBtn: { background: '#ef4444', boxShadow: '0 6px 20px rgba(239,68,68,0.5)' },
  tip: { fontSize: 10, color: '#64748b', textAlign: 'center' },
};
