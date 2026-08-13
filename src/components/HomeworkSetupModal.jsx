import React, { useState } from 'react';

// Must match QTYPE_META keys/marks in backend/openai_service.py
const QUESTION_TYPES = [
  { type: 'mcq',          label: 'Multiple choice',    hint: '4 options, one correct', marks: 1, icon: '🔘' },
  { type: 'true_false',   label: 'True / False',       hint: 'judge a statement',      marks: 1, icon: '✔️' },
  { type: 'fill_blank',   label: 'Fill in the blank',  hint: 'one-word answer',        marks: 1, icon: '✏️' },
  { type: 'short_answer', label: 'Short answer',       hint: '2-3 sentences',          marks: 2, icon: '📝' },
  { type: 'long_answer',  label: 'Long answer',        hint: 'detailed explanation',   marks: 5, icon: '📄' },
];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const stepBtnStyle = {
  width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--glass-border)',
  background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '16px', fontWeight: '700',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};

/**
 * Homework setup card (centre-screen overlay). The teacher/student chooses how many
 * of each question type to include and the difficulty, then clicks Generate.
 */
export default function HomeworkSetupModal({ open, busy, difficulty, setDifficulty, onGenerate, onClose }) {
  // counts keyed by question type
  const [counts, setCounts] = useState({ mcq: 2, true_false: 2, fill_blank: 0, short_answer: 1, long_answer: 0 });

  if (!open) return null;

  const setCount = (type, delta) =>
    setCounts((c) => ({ ...c, [type]: Math.max(0, Math.min(15, (c[type] || 0) + delta)) }));

  const totalQ = QUESTION_TYPES.reduce((s, t) => s + (counts[t.type] || 0), 0);
  const totalMarks = QUESTION_TYPES.reduce((s, t) => s + (counts[t.type] || 0) * t.marks, 0);

  const handleGenerate = () => {
    if (totalQ === 0 || busy) return;
    const question_mix = QUESTION_TYPES
      .filter((t) => (counts[t.type] || 0) > 0)
      .map((t) => ({ type: t.type, count: counts[t.type] }));
    onGenerate(question_mix);
  };

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
          borderRadius: '20px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-main)', fontSize: '20px' }}>
            📄 Homework setup
          </h2>
          <button onClick={onClose} disabled={busy}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: busy ? 'default' : 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Choose the question types and how many of each. The homework is built from the current page.
        </p>

        {/* Difficulty */}
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Difficulty
        </label>
        <div style={{ display: 'flex', gap: '8px', margin: '8px 0 20px' }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className="control-btn"
              style={{
                flex: 1, justifyContent: 'center',
                background: difficulty === d ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: difficulty === d ? '#fff' : 'var(--text-main)',
                border: difficulty === d ? '1px solid var(--accent-color)' : '1px solid var(--glass-border)',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Question type steppers */}
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Question types
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '10px 0 18px' }}>
          {QUESTION_TYPES.map((t) => (
            <div key={t.type} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)',
              borderRadius: '12px', padding: '10px 12px',
            }}>
              <span style={{ fontSize: '18px' }}>{t.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                  {t.label} <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>· {t.marks} mark{t.marks > 1 ? 's' : ''}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.hint}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setCount(t.type, -1)} style={stepBtnStyle} aria-label={`Fewer ${t.label}`}>−</button>
                <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: '800', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
                  {counts[t.type] || 0}
                </span>
                <button onClick={() => setCount(t.type, +1)} style={stepBtnStyle} aria-label={`More ${t.label}`}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Total + actions */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '12px',
          border: '1px solid var(--glass-border)', marginBottom: '16px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Total</span>
          <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: '800' }}>
            {totalQ} question{totalQ !== 1 ? 's' : ''} · {totalMarks} marks
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="control-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="control-btn success"
            style={{ flex: 2, justifyContent: 'center' }}
            onClick={handleGenerate}
            disabled={totalQ === 0 || busy}
          >
            {busy ? 'Generating…' : '✨ Generate homework'}
          </button>
        </div>
      </div>
    </div>
  );
}
