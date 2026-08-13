import React, { useState } from 'react';

export default function LearningOutcomesBanner({
  loData,
  isLoading,
  onClose,
  onPlayAvatarBriefing,
}) {
  const [confidenceRatings, setConfidenceRatings] = useState({});
  const [isMinimized, setIsMinimized] = useState(false);

  if (isLoading) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div style={{ fontSize: '24px', animation: 'spin 2s linear infinite' }}>🎯</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#ffffff' }}>
            Preparing Chapter Orientation…
          </div>
          <div style={{ fontSize: '12px', color: '#c7d2fe' }}>
            Extracting Learning Outcomes & Chapter Objectives for you.
          </div>
        </div>
      </div>
    );
  }

  if (!loData) return null;

  const {
    chapter_title = 'Chapter Overview',
    objective = '',
    why_it_matters = '',
    learning_outcomes = [],
    avatar_intro = '',
  } = loData;

  const handleRating = (index, rating) => {
    setConfidenceRatings((prev) => ({ ...prev, [index]: rating }));
  };

  // Minimized Top Bar state
  if (isMinimized) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '10px 18px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
          cursor: 'pointer',
        }}
        onClick={() => setIsMinimized(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🎯</span>
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.3px' }}>
            Pre-Flight Orientation: {chapter_title}
          </span>
          <span
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {learning_outcomes.length} Outcomes
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          style={{
            background: '#ffffff',
            color: '#4338ca',
            border: 'none',
            borderRadius: '8px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Expand Objectives ▼
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '2px solid #818cf8',
        borderRadius: '20px',
        padding: '20px 24px',
        marginBottom: '14px',
        boxShadow: '0 12px 32px rgba(79, 70, 229, 0.15)',
        position: 'relative',
        zIndex: 10,
        color: '#0f172a',
      }}
    >
      {/* Top Banner Header */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            🎯 PRE-FLIGHT ORIENTATION
          </span>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            {chapter_title}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Minimize to top bar"
          >
            ▲ Minimize
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Close Orientation"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Left Column: Chapter Objective */}
        {objective && (
          <div
            style={{
              background: '#f8fafc',
              borderLeft: '5px solid #4f46e5',
              border: '1px solid #e2e8f0',
              borderLeftWidth: '5px',
              borderRadius: '12px',
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
              📍 Chapter Objective
            </div>
            <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: '1.5', fontWeight: 600 }}>
              {objective}
            </div>
          </div>
        )}

        {/* Right Column: Why This Matters */}
        {why_it_matters && (
          <div
            style={{
              background: '#fffbeb',
              borderLeft: '5px solid #d97706',
              border: '1px solid #fef3c7',
              borderLeftWidth: '5px',
              borderRadius: '12px',
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
              💡 Why This Matters (Real-World Context)
            </div>
            <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.5', fontWeight: 600 }}>
              {why_it_matters}
            </div>
          </div>
        )}
      </div>

      {/* Learning Outcomes List */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
            📋 Learning Outcomes (What you will know & perform)
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            Rate your starting confidence (1–5 ★)
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {learning_outcomes.map((lo, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, lineHeight: 1.4 }}>
                  {lo}
                </span>
              </div>

              {/* 5-Star Confidence Rating */}
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(idx, star)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '2px',
                      color: star <= (confidenceRatings[idx] || 0) ? '#d97706' : '#cbd5e1',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
        {avatar_intro && (
          <button
            onClick={() => onPlayAvatarBriefing(avatar_intro)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
            }}
          >
            🎙️ Play Avatar Briefing
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 20px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #059669, #10b981)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
          }}
        >
          🚀 Start Chapter Lesson
        </button>
      </div>
    </div>
  );
}
