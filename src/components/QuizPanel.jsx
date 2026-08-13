import React, { useState } from 'react';
import { apiUrl, ENDPOINTS } from '../config';

export default function QuizPanel({ questions, onSubmitAnswers, onResetQuiz, llmProvider }) {
  const [selectedAnswers, setSelectedAnswers] = useState(Array(questions.length).fill(null));
  const [gradingResult, setGradingResult] = useState(null);
  const [isGrading, setIsGrading] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const handleSelectOption = (qIdx, oIdx) => {
    const updated = [...selectedAnswers];
    updated[qIdx] = oIdx;
    setSelectedAnswers(updated);
    if (!updated.includes(null)) {
      setShowValidationErrors(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedAnswers.includes(null)) {
      setShowValidationErrors(true);
      return;
    }
    setIsGrading(true);
    try {
      const response = await fetch(apiUrl(ENDPOINTS.grade), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, user_answers: selectedAnswers, llm_provider: llmProvider })
      });
      if (!response.ok) throw new Error("Failed to evaluate quiz");
      const result = await response.json();
      setGradingResult(result);
      if (onSubmitAnswers) onSubmitAnswers(result);
    } catch (e) {
      alert("Error grading quiz: " + e.message);
    } finally {
      setIsGrading(false);
    }
  };

  if (gradingResult) {
    const pct = Math.round((gradingResult.correct_count / gradingResult.total_questions) * 100);
    return (
      <div className="quiz-widget" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          <div className="quiz-header">
            <span>Quiz Scorecard</span>
          </div>

          {/* Score Ring */}
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
                fontWeight: '800', fontSize: '17px', color: 'var(--accent-color)', fontFamily: 'var(--font-display)'
              }}>
                {pct}%
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', color: pct >= 70 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: '700' }}>
                {gradingResult.correct_count} / {gradingResult.total_questions} Correct
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {pct >= 80 ? '🌟 Excellent!' : pct >= 60 ? '✅ Passed' : '📚 Needs Review'}
              </p>
            </div>
          </div>

          {/* Feedback */}
          <div style={{ fontStyle: 'italic', fontSize: '12px', background: 'var(--bg-tertiary)', padding: '11px 15px', borderRadius: '12px', borderLeft: '3px solid var(--accent-color)', lineHeight: '1.5' }}>
            "{gradingResult.feedback_summary}"
          </div>

          {/* Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>Question Breakdown</h4>
            {questions.map((q, idx) => {
              const userAns = selectedAnswers[idx];
              const isCorrect = userAns === q.answer_index;
              return (
                <div key={idx} style={{ padding: '12px 14px', borderRadius: '12px', background: isCorrect ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.07)', border: `1px solid ${isCorrect ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}` }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>Q{idx+1}: {q.question}</p>
                  <p style={{ fontSize: '12px', color: isCorrect ? 'var(--success-color)' : 'var(--error-color)', fontWeight: '600' }}>
                    Your answer: {q.options[userAns]} {isCorrect ? '✓' : '✗'}
                  </p>
                  {!isCorrect && (
                    <p style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>
                      Correct: {q.options[q.answer_index]}
                    </p>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontStyle: 'italic', lineHeight: '1.5' }}>
                    {q.explanation}
                  </p>
                </div>
              );
            })}
          </div>

          <button className="control-btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }} onClick={onResetQuiz}>
            🔄 Reset &amp; Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-widget">
      <div className="quiz-header">
        <span>Active Page Quiz</span>
        <span>{selectedAnswers.filter(x => x !== null).length}/{questions.length} Answered</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '4px' }}>
        {questions.map((q, qIdx) => {
          const isUnanswered = showValidationErrors && selectedAnswers[qIdx] === null;
          return (
            <div
              key={qIdx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'var(--bg-secondary)',
                padding: '18px',
                borderRadius: '14px',
                border: isUnanswered ? '1.5px solid var(--error-color)' : '1px solid var(--glass-border)',
                boxShadow: isUnanswered ? '0 0 10px rgba(251, 113, 133, 0.15)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
            >
              <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span>
                  <span style={{ color: 'var(--accent-color)', marginRight: '6px' }}>Q{qIdx + 1}.</span>{q.question}
                </span>
                {isUnanswered && (
                  <span style={{ color: 'var(--error-color)', fontSize: '12px', fontWeight: '600', marginTop: '2px' }}>
                    ⚠️ Please select an answer for this question.
                  </span>
                )}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.options.map((option, oIdx) => (
                  <button
                    key={oIdx}
                    className={`quiz-option-btn ${selectedAnswers[qIdx] === oIdx ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(qIdx, oIdx)}
                  >
                    <span style={{ fontWeight: '700', marginRight: '8px', opacity: 0.7 }}>{String.fromCharCode(65 + oIdx)}.</span>{option}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="control-btn success"
        style={{ marginTop: '20px', justifyContent: 'center', fontSize: '14px', padding: '13px', width: '100%' }}
        disabled={isGrading}
        onClick={handleSubmit}
      >
        {isGrading ? "Evaluating…" : "✅ Submit Answers"}
      </button>
    </div>
  );
}
