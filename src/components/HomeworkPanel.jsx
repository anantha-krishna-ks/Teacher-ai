import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl, ENDPOINTS } from '../config';

/**
 * Written-homework workspace:
 *   1. shows the generated questions (with options for MCQ / True-False)
 *   2. student uploads OR live-captures photo(s) of the handwritten answers
 *   3. we POST the image(s) + questions to the backend, which grades against the rubric
 *   4. show marks + per-question feedback
 */
export default function HomeworkPanel({ questions, language = 'English', onReset }) {
  const [files, setFiles] = useState([]);        // File objects (uploaded or captured)
  const [previews, setPreviews] = useState([]);  // { name, url } for thumbnails
  const [isGrading, setIsGrading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // camera
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const totalMarks = questions.reduce((s, q) => s + (q.max_marks || 0), 0);

  // Append new files + build preview thumbnails.
  const addFiles = (newFiles) => {
    if (!newFiles.length) return;
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))]);
    setError('');
  };

  const removeAt = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Camera ──
  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },  // prefer the rear camera for documents
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (e) {
      setError('Could not access the camera. Please allow camera permission (or use upload).');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  // Attach the stream once the <video> is mounted.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  // Stop the camera when the panel unmounts.
  useEffect(() => () => stopCamera(), []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      addFiles([file]);
    }, 'image/jpeg', 0.92);
  };

  const handleUpload = (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';  // allow re-selecting the same file
  };

  const handleEvaluate = async () => {
    if (!files.length) { setError('Please upload or capture a photo of your answers first.'); return; }
    stopCamera();
    setIsGrading(true);
    setError('');
    try {
      const form = new FormData();
      // Send questions WITH answer_key + rubric so the backend can grade fairly.
      form.append('questions', JSON.stringify(questions));
      form.append('language', language);
      files.forEach((f) => form.append('files', f));

      const res = await fetch(apiUrl(ENDPOINTS.homeworkEvaluate), { method: 'POST', body: form });
      if (!res.ok) throw new Error('Evaluation failed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError('Could not evaluate: ' + err.message);
    } finally {
      setIsGrading(false);
    }
  };

  // ── Rejected: not handwritten (typed / printed / screenshot) ──
  if (result && result.rejected) {
    return (
      <div className="quiz-widget" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '40px' }}>🚫</div>
          <h3 style={{ fontSize: '18px', color: 'var(--error-color)', fontWeight: '700' }}>
            Submission not accepted
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6' }}>
            {result.reason}
          </p>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px 14px', lineHeight: '1.6', textAlign: 'left' }}>
            📝 Please answer the questions <b>by hand on paper</b>, then take a clear photo.
            Typed answers or screenshots (e.g. from a chat app) are not accepted.
          </div>
          <button
            className="control-btn primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setResult(null); setFiles([]); setPreviews([]); }}
          >
            ↩ Try again with handwritten answers
          </button>
        </div>
      </div>
    );
  }

  // ── Results view ──
  if (result && result.results) {
    const got = result.total_awarded ?? result.results.reduce((s, r) => s + (r.marks_awarded || 0), 0);
    const outOf = result.total_max ?? result.results.reduce((s, r) => s + (r.max_marks || 0), 0);
    const pct = outOf ? Math.round((got / outOf) * 100) : 0;

    return (
      <div className="quiz-widget" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          <div className="quiz-header"><span>Homework Result</span></div>

          {/* Score ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '4px 0' }}>
            <div style={{
              width: '84px', height: '84px', borderRadius: '50%',
              background: `conic-gradient(#7c5cff ${pct}%, var(--bg-tertiary) 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px var(--accent-glow)'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '16px', color: 'var(--accent-color)', fontFamily: 'var(--font-display)'
              }}>{pct}%</div>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', color: pct >= 70 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: '700' }}>
                {got} / {outOf} Marks
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {pct >= 80 ? '🌟 Excellent!' : pct >= 60 ? '✅ Good work' : '📚 Needs practice'}
              </p>
            </div>
          </div>

          {/* Per-question breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
              Answer breakdown
            </h4>
            {result.results.map((r, idx) => {
              const full = (r.marks_awarded || 0) === (r.max_marks || 0) && (r.max_marks || 0) > 0;
              const zero = (r.marks_awarded || 0) === 0;
              const color = full ? 'var(--success-color)' : zero ? 'var(--error-color)' : '#f59e0b';
              const bg = full ? 'rgba(52,211,153,0.07)' : zero ? 'rgba(251,113,133,0.07)' : 'rgba(245,158,11,0.07)';
              const bd = full ? 'rgba(52,211,153,0.25)' : zero ? 'rgba(251,113,133,0.25)' : 'rgba(245,158,11,0.25)';
              return (
                <div key={idx} style={{ padding: '12px 14px', borderRadius: '12px', background: bg, border: `1px solid ${bd}` }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Q{r.question_no ?? idx + 1} — <span style={{ color }}>{r.marks_awarded ?? 0}/{r.max_marks ?? 0} marks</span>
                  </p>
                  {r.student_answer_read && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontStyle: 'italic' }}>
                      Read from image: {r.student_answer_read}
                    </p>
                  )}
                  {Array.isArray(r.correct_points) && r.correct_points.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>✓ {r.correct_points.join(' · ')}</p>
                  )}
                  {Array.isArray(r.mistakes) && r.mistakes.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--error-color)', fontWeight: '600' }}>✗ {r.mistakes.join(' · ')}</p>
                  )}
                  {r.feedback && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', lineHeight: '1.5' }}>{r.feedback}</p>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.5' }}>
            ⚠️ AI grading can misread handwriting — a teacher should review before marks are final.
          </p>

          <button className="control-btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onReset}>
            🔄 New Homework
          </button>
        </div>
      </div>
    );
  }

  // ── Questions + upload/capture view ──
  return (
    <div className="quiz-widget" style={{ padding: '20px' }}>
      <div className="quiz-header">
        <span>Homework</span>
        <span>{questions.length} questions · {totalMarks} marks</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
        {questions.map((q, idx) => (
          <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--accent-color)', marginRight: '6px' }}>Q{idx + 1}.</span>{q.question}
              <span style={{ color: 'var(--text-muted)', fontWeight: '600', marginLeft: '8px', fontSize: '12px' }}>({q.max_marks} marks)</span>
            </p>
            {Array.isArray(q.options) && q.options.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
                {q.options.map((opt, oi) => (
                  <span key={oi} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <b style={{ color: 'var(--text-main)', marginRight: '6px' }}>{String.fromCharCode(65 + oi)}.</b>{opt}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Capture / upload */}
      <div style={{ marginTop: '18px', padding: '16px', border: '1.5px dashed var(--glass-border)', borderRadius: '14px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>📤 Your answer sheet</p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Solve on paper, then capture with your camera or upload photo(s). You can add multiple pages.
        </p>

        {cameraOn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: '100%', maxWidth: '320px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: '#000' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="control-btn success" onClick={capturePhoto}>📸 Capture</button>
              <button className="control-btn" onClick={stopCamera}>✖ Stop camera</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="control-btn" onClick={startCamera}>📷 Use camera</button>
            <input id="hw-upload" type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
            <label htmlFor="hw-upload" className="control-btn" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              🖼️ Upload photo(s)
            </label>
          </div>
        )}

        {previews.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '14px' }}>
            {previews.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={p.url} alt={p.name} style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
                <button
                  onClick={() => removeAt(i)}
                  title="Remove"
                  style={{
                    position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
                    borderRadius: '50%', border: 'none', background: 'var(--error-color)', color: '#fff',
                    fontSize: '12px', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}
        {previews.length > 0 && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>{previews.length} page(s) added</p>
        )}
      </div>

      {error && <p style={{ color: 'var(--error-color)', fontSize: '12px', marginTop: '10px', fontWeight: '600' }}>{error}</p>}

      <button
        className="control-btn success"
        style={{ marginTop: '16px', justifyContent: 'center', fontSize: '14px', padding: '13px', width: '100%' }}
        disabled={isGrading || !files.length}
        onClick={handleEvaluate}
      >
        {isGrading ? 'Reading & grading…' : '✅ Submit for evaluation'}
      </button>

      {/* ── Full-screen Porcelain Loader matching the rest of the application ── */}
      {isGrading && createPortal(
        <div className="upload-loader-overlay theme-day">
          <div className="upload-loader-card">
            <div className="upload-loader-ring">
              <span className="upload-loader-emoji">📝</span>
            </div>
            <div className="upload-loader-text">
              <h3>Evaluating Homework…</h3>
              <p>Reading handwritten answers & grading against rubric.</p>
            </div>
            <div className="upload-loader-bar">
              <span />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
