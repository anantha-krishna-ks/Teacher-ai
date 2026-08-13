import React, { useState } from 'react';

// ── Pre-Flight Chapter Orientation Modal ──────────────────────────────────────
const CONFIDENCE_LABELS = ['Brand new', 'Shaky', 'Getting there', 'Fairly sure', 'Confident'];

function Star({ filled, onClick, title }) {
  return (
    <button
      type="button"
      className={`lo-star${filled ? ' filled' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path
          d="M12 2.6l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.42l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}

function LoadingCard() {
  return (
    <div className="upload-loader-overlay theme-day">
      <div className="upload-loader-card">
        <div className="upload-loader-ring">
          <span className="upload-loader-emoji">🎯</span>
        </div>
        <div className="upload-loader-text">
          <h3>Preparing Chapter Orientation…</h3>
          <p>Extracting chapter objectives and learning outcomes.</p>
        </div>
        <div className="upload-loader-bar">
          <span />
        </div>
      </div>
    </div>
  );
}

export default function LearningOutcomesModal({
  loData,
  isLoading,
  onStartLesson,
  onClose,
  allowManualClose = false,
}) {
  const [confidenceRatings, setConfidenceRatings] = useState({});

  if (isLoading) return <LoadingCard />;
  if (!loData) return null;

  const {
    chapter_title = 'Chapter Overview',
    objective = '',
    why_it_matters = '',
    learning_outcomes = [],
    avatar_intro = '',
  } = loData;

  const rate = (index, rating) =>
    setConfidenceRatings((prev) => ({ ...prev, [index]: prev[index] === rating ? 0 : rating }));

  return (
    <div className="lo-overlay">
      <div className="lo-card">
        {allowManualClose && (
          <button className="lo-close" onClick={onClose} title="Close" aria-label="Close">✕</button>
        )}

        {/* ── Header ── */}
        <div className="lo-head">
          <div className="lo-eyebrow"><span className="lo-dot" />PRE-FLIGHT ORIENTATION</div>
          <h2 className="lo-title">{chapter_title}</h2>
        </div>

        {/* ── Scrollable body ── */}
        <div className="lo-scroll">
          <div className="lo-duo">
            {objective && (
              <section className="lo-panel">
                <div className="lo-panel-head">
                  <span className="lo-tile">🧭</span>
                  <span className="lo-panel-label">CHAPTER OBJECTIVE</span>
                </div>
                <p className="lo-panel-text">{objective}</p>
              </section>
            )}
            {why_it_matters && (
              <section className="lo-panel">
                <div className="lo-panel-head">
                  <span className="lo-tile">💡</span>
                  <span className="lo-panel-label">WHY THIS MATTERS</span>
                </div>
                <p className="lo-panel-text">{why_it_matters}</p>
              </section>
            )}
          </div>

          {learning_outcomes.length > 0 && (
            <section className="lo-section">
              <div className="lo-section-head">
                <h3 className="lo-section-title">By the end, you will be able to…</h3>
                <span className="lo-section-hint">Rate where you're starting</span>
              </div>

              <ul className="lo-outcomes">
                {learning_outcomes.map((lo, idx) => {
                  const rating = confidenceRatings[idx] || 0;
                  return (
                    <li key={idx} className={`lo-outcome${rating ? ' rated' : ''}`}>
                      <span className="lo-num">{idx + 1}</span>
                      <span className="lo-outcome-text">{lo}</span>
                      <span className="lo-rate">
                        {rating > 0 && <span className="lo-rate-label">{CONFIDENCE_LABELS[rating - 1]}</span>}
                        <span className="lo-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              filled={star <= rating}
                              onClick={() => rate(idx, star)}
                              title={`${CONFIDENCE_LABELS[star - 1]} (${star} of 5)`}
                            />
                          ))}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="lo-foot">
          <button className="lo-cta" onClick={() => onStartLesson(avatar_intro)}>
            <span>Start Chapter Lesson</span>
            <span style={{ fontSize: '15px' }} aria-hidden="true">🚀</span>
          </button>
        </div>
      </div>
    </div>
  );
}
