import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, GestureRecognizer, FaceLandmarker } from '@mediapipe/tasks-vision';

// ── Attention thresholds ────────────────────────────────────────────────────
// Head pose is measured in DEGREES from the facial transformation matrix, so the
// numbers below mean the same thing on every webcam, seating position and frame
// rate. (The old landmark-delta heuristic drifted badly when the student sat
// off-centre, and the frame COUNT it used meant "5 seconds" was really anywhere
// from 1s to 9s depending on how fast the machine rendered.)
const YAW_LIMIT_DEG = 25;      // turning left/right away from the screen
const PITCH_LIMIT_DEG = 20;    // looking down (phone / notebook) or up

// The student must look away CONTINUOUSLY for this long before the lesson pauses.
const AWAY_TRIGGER_MS = 5000;

// …and must look back steadily for this long before the away-timer is forgiven.
// Without this hysteresis a single focused frame reset the counter, so a student
// glancing back every few seconds would never trigger the guard at all.
const FOCUS_RESET_MS = 1200;

// Fallback thresholds for the landmark heuristic, used only if the runtime does
// not return a transformation matrix.
const FALLBACK_YAW = 0.065;
const FALLBACK_PITCH = 0.08;

/**
 * Extract head yaw/pitch in degrees from MediaPipe's 4x4 facial transformation
 * matrix (column-major, 16 floats).
 */
function headPoseDegrees(matrixData) {
  const d = matrixData;
  if (!d || d.length < 16) return null;
  // Rotation part, column-major: R[row][col] = d[col * 4 + row]
  const r02 = d[8], r10 = d[1], r12 = d[9], r22 = d[10];
  const yaw = Math.atan2(r02, r22) * (180 / Math.PI);
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r12))) * (180 / Math.PI);
  const roll = Math.atan2(r10, d[5]) * (180 / Math.PI);
  return { yaw, pitch, roll };
}

export default function MediaPipeVision({
  isActive,
  showVideoPreview,
  // `armed` gates the ENFORCING behaviour: focus is always measured while the
  // camera is on, but onAttentionLost only fires when the lesson is actually
  // being spoken (see App.jsx). Flipping it also resets the timers, which is how
  // the post-resume cooldown works.
  armed = false,
  awayTriggerMs = AWAY_TRIGGER_MS,
  showVideoPreviewBadge = true,
  onAttentionLost,
  onAttentionRestored,
  onGesture,
  onFocusScoreUpdate,
  onStatsUpdate,
}) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('initializing'); // initializing | active | looking_away | error
  const [activeGesture, setActiveGesture] = useState(null);
  const [focusPercentage, setFocusPercentage] = useState(100);
  const [countdown, setCountdown] = useState(null);      // seconds left before the pause fires

  const gestureRecognizerRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  // ── Timing state (all wall-clock milliseconds, never frame counts) ──
  const awaySinceRef = useRef(null);      // when the current look-away streak began
  const focusSinceRef = useRef(null);     // when the current look-back streak began
  const lastFrameAtRef = useRef(0);
  const focusedMsRef = useRef(0);
  const totalMsRef = useRef(0);
  const isAwayRef = useRef(false);        // has the guard already fired this streak?
  const lastGestureTimeRef = useRef(0);
  const lastScoreEmitRef = useRef(0);
  const countdownActiveRef = useRef(false);   // mirrors `countdown` for the rAF loop
  const lastStatsRef = useRef(null);          // last stats pushed to the parent

  // Distraction tally for the lesson report.
  const distractionCountRef = useRef(0);
  const awayMsRef = useRef(0);

  // Latest callbacks/props, read inside the rAF loop without re-subscribing it.
  const cbRef = useRef({});
  cbRef.current = { onAttentionLost, onAttentionRestored, onGesture, onFocusScoreUpdate, onStatsUpdate, armed, awayTriggerMs };

  /** Clear the away/focus streaks — used on (dis)arm and after a resume. */
  const resetAttentionTimers = () => {
    awaySinceRef.current = null;
    focusSinceRef.current = null;
    isAwayRef.current = false;
    setCountdown(null);
    setStatus((s) => (s === 'looking_away' ? 'active' : s));
  };

  // Re-arming (after the resume cooldown) must start from a clean slate, or the
  // guard would instantly re-fire on the streak that triggered the last pause.
  useEffect(() => {
    resetAttentionTimers();
  }, [armed]);

  // ── Initialize MediaPipe Vision WASM tasks ──
  useEffect(() => {
    if (!isActive) return;

    let isMounted = true;

    const initMediaPipe = async () => {
      try {
        setStatus('initializing');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        if (!isMounted) return;

        // Initialize Gesture Recognizer
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        // Initialize Face Landmarker for head pose & gaze tracking.
        // outputFacialTransformationMatrixes gives a real head-pose matrix, which
        // is far more stable than comparing raw landmark coordinates.
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true
        });

        // Start Webcam Stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: { max: 30 } }
        });

        if (!isMounted) return;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setStatus('active');
            lastFrameAtRef.current = performance.now();
            startDetectionLoop();
          };
        }
      } catch (err) {
        console.error("[MediaPipeVision] Initialization error:", err);
        if (isMounted) setStatus('error');
      }
    };

    initMediaPipe();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      resetAttentionTimers();
    };
  }, [isActive]);

  // ── Tab switching counts as distraction too ──
  // requestAnimationFrame is throttled to a halt in a hidden tab, so the camera
  // loop simply freezes and would read the last frame as "focused" forever. A
  // timer catches the student who alt-tabs away mid-explanation.
  useEffect(() => {
    if (!isActive) return;
    let hiddenTimer = null;

    const onVisibilityChange = () => {
      clearTimeout(hiddenTimer);
      if (document.hidden) {
        const { armed: isArmed, awayTriggerMs: ms, onAttentionLost: lost } = cbRef.current;
        if (!isArmed) return;
        hiddenTimer = setTimeout(() => {
          if (!document.hidden || isAwayRef.current) return;
          isAwayRef.current = true;
          distractionCountRef.current += 1;
          setStatus('looking_away');
          if (lost) lost('tab_hidden');
        }, ms);
      } else {
        // Back on the tab — clear stale streaks so the camera starts fresh.
        lastFrameAtRef.current = performance.now();
        if (!isAwayRef.current) resetAttentionTimers();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive]);

  // ── Detection loop (requestAnimationFrame) ──
  const startDetectionLoop = () => {
    const processFrame = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const now = performance.now();
      // Clamp the delta so a backgrounded tab (one huge gap) can't poison the score.
      const dt = Math.min(now - (lastFrameAtRef.current || now), 250);
      lastFrameAtRef.current = now;
      totalMsRef.current += dt;

      const { armed: isArmed, awayTriggerMs: triggerMs } = cbRef.current;

      // 1. Head pose → is the student facing the screen?
      if (faceLandmarkerRef.current) {
        try {
          const faceResults = faceLandmarkerRef.current.detectForVideo(video, Date.now());
          const landmarks = faceResults?.faceLandmarks?.[0];
          let distracted;
          let reason = 'looking_away';

          if (!landmarks) {
            // No face at all — the student left the seat or turned right around.
            distracted = true;
            reason = 'no_face';
          } else {
            const pose = headPoseDegrees(faceResults?.facialTransformationMatrixes?.[0]?.data);
            if (pose) {
              distracted = Math.abs(pose.yaw) > YAW_LIMIT_DEG || Math.abs(pose.pitch) > PITCH_LIMIT_DEG;
            } else {
              // Runtime didn't give us a matrix — fall back to the landmark heuristic.
              const nose = landmarks[1], leftEye = landmarks[33], rightEye = landmarks[263];
              const eyeCenter = (leftEye.x + rightEye.x) / 2;
              distracted = Math.abs(nose.x - eyeCenter) > FALLBACK_YAW
                        || Math.abs(nose.y - leftEye.y) > FALLBACK_PITCH;
            }
          }

          if (distracted) {
            focusSinceRef.current = null;
            if (awaySinceRef.current === null) awaySinceRef.current = now;
            awayMsRef.current += dt;

            const awayFor = now - awaySinceRef.current;
            if (isArmed && !isAwayRef.current) {
              const left = Math.ceil((triggerMs - awayFor) / 1000);
              setCountdown(left > 0 ? left : null);
              if (awayFor >= triggerMs) {
                isAwayRef.current = true;
                distractionCountRef.current += 1;
                setStatus('looking_away');
                setCountdown(null);
                if (cbRef.current.onAttentionLost) cbRef.current.onAttentionLost(reason);
              }
            }
          } else {
            focusedMsRef.current += dt;
            if (focusSinceRef.current === null) focusSinceRef.current = now;
            // Only forgive the away-streak after a sustained look-back.
            if (now - focusSinceRef.current >= FOCUS_RESET_MS) {
              if (awaySinceRef.current !== null || isAwayRef.current) {
                const wasFlagged = isAwayRef.current;
                awaySinceRef.current = null;
                isAwayRef.current = false;
                setStatus('active');
                setCountdown(null);
                if (wasFlagged && cbRef.current.onAttentionRestored) cbRef.current.onAttentionRestored();
              } else if (countdownActiveRef.current) {
                setCountdown(null);
              }
            }
          }
        } catch (_) {}
      }

      // Recompute the focus score (time-weighted, not frame-weighted) 4x a second
      // for the local badge, but only push it UP to the parent when a whole-number
      // value actually changes — App re-renders the whole classroom view (PDF
      // included), so a stats callback on every tick would make the page stutter.
      if (now - lastScoreEmitRef.current > 250) {
        lastScoreEmitRef.current = now;
        const total = totalMsRef.current;
        if (total > 0) {
          const score = Math.round((focusedMsRef.current / total) * 100);
          setFocusPercentage(score);

          const stats = {
            focusScore: score,
            distractions: distractionCountRef.current,
            awaySeconds: Math.round(awayMsRef.current / 1000),
          };
          const prev = lastStatsRef.current;
          if (!prev || prev.focusScore !== stats.focusScore
                    || prev.distractions !== stats.distractions
                    || prev.awaySeconds !== stats.awaySeconds) {
            lastStatsRef.current = stats;
            if (prev?.focusScore !== stats.focusScore && cbRef.current.onFocusScoreUpdate) {
              cbRef.current.onFocusScoreUpdate(score);
            }
            if (cbRef.current.onStatsUpdate) cbRef.current.onStatsUpdate(stats);
          }
        }
      }

      // 2. Hand gestures (unchanged)
      if (gestureRecognizerRef.current && now - lastGestureTimeRef.current > 1200) {
        try {
          const gestureResults = gestureRecognizerRef.current.recognizeForVideo(video, Date.now());
          const topGesture = gestureResults?.gestures?.[0]?.[0];
          if (topGesture) {
            const name = topGesture.categoryName || '';
            const score = topGesture.score || 0;
            const fire = (label, type) => {
              setActiveGesture(label);
              lastGestureTimeRef.current = now;
              if (cbRef.current.onGesture) cbRef.current.onGesture(type);
              setTimeout(() => setActiveGesture(null), 2500);
            };

            if (name === 'Open_Palm' && score > 0.60) fire('✋ Raised Hand', 'raise_hand');
            else if (name === 'Thumb_Up' && score > 0.50) fire('👍 Next Page', 'thumbs_up');
            else if ((name === 'Thumb_Down' || name.toLowerCase().includes('down')) && score > 0.45) fire('👎 Prev Page', 'thumbs_down');
            else if ((name === 'Victory' || name === 'Pointing_Up') && score > 0.60) fire('👉 Next Page', 'next_page');
          }
        } catch (_) {}
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  countdownActiveRef.current = countdown !== null;

  if (!isActive) return null;

  return (
    <div style={S.container}>
      {/* Hidden Video element for WebGL processing */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={showVideoPreview ? S.visibleVideo : S.hiddenVideo}
      />

      {/* Floating PIP Control & Status Badge */}
      {showVideoPreviewBadge && (
        <div style={S.badgeWrap}>
          <div style={{
            ...S.statusBadge,
            background: countdown !== null ? '#f97316'
              : status === 'looking_away' ? '#f59e0b'
              : status === 'active' ? '#10b981' : '#64748b'
          }}>
            {status === 'initializing' && '⏳ Vision Loading…'}
            {status === 'active' && countdown === null && `🟢 Focused (${focusPercentage}%)`}
            {status === 'active' && countdown !== null && `👀 Look back… ${countdown}s`}
            {status === 'looking_away' && '🟡 Attention Lost'}
            {status === 'error' && '⚠️ Camera Blocked'}
          </div>

          {activeGesture && (
            <div style={S.gestureBadge}>
              {activeGesture}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  container: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 9990,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    pointerEvents: 'none'
  },
  visibleVideo: {
    width: 140,
    height: 105,
    borderRadius: 12,
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.2)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
    pointerEvents: 'auto'
  },
  hiddenVideo: {
    display: 'none'
  },
  badgeWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    pointerEvents: 'auto'
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: 20,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.2,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(6px)'
  },
  gestureBadge: {
    padding: '6px 12px',
    borderRadius: 20,
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(99,102,241,0.5)',
    animation: 'pulse 0.8s ease-out'
  }
};
