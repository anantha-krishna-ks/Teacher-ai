import React, { useState } from 'react';
import { apiUrl, ENDPOINTS } from '../config';

// The practice-question formats offered as chips in the chat after "Teach Me Page".
const FORMATS = [
  { qtype: 'mcq',          label: 'MCQ',              icon: '🧠' },
  { qtype: 'fill_blank',   label: 'Fill in the blank', icon: '✏️' },
  { qtype: 'true_false',   label: 'True / False',     icon: '✅' },
  { qtype: 'short_answer', label: 'Short answer',     icon: '💬' },
];

const isChoiceType = (t) => t === 'mcq' || t === 'true_false';

// ── Follow-up action chips shown in the chat ──
export function ChatFollowUps({ onPick, disabled, title = 'Test yourself on this page:' }) {
  return (
    <div className="chat-followups">
      <div className="chat-followups-title">{title}</div>
      <div className="chat-chips">
        {FORMATS.map((f) => (
          <button
            key={f.qtype}
            type="button"
            className="chat-chip"
            disabled={disabled}
            onClick={() => onPick(f.qtype)}
          >
            <span aria-hidden="true">{f.icon}</span> {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── A single interactive question rendered inside the chat ──
export function ChatQuestionCard({ q, language, llmProvider, onAskAnother }) {
  const [selected, setSelected] = useState(null);   // choice types
  const [text, setText] = useState('');             // typed types
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);       // { is_correct, feedback } for typed types

  const choice = isChoiceType(q.type);

  const submitChoice = () => {
    if (selected === null || submitted) return;
    setSubmitted(true);
  };

  const submitTyped = async () => {
    if (!text.trim() || submitted || busy) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(ENDPOINTS.validate), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          expected: q.answer || '',
          acceptable_answers: q.acceptable_answers || [],
          user_answer: text.trim(),
          language,
          llm_provider: llmProvider,
        }),
      });
      if (!res.ok) throw new Error('Validation failed');
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch {
      setResult({ is_correct: false, feedback: 'Sorry, I could not check that answer. Please try again.' });
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  const choiceCorrect = choice && submitted && selected === q.answer_index;

  return (
    <div className="chatq">
      <div className="chatq-type">{labelFor(q.type)}</div>
      <div className="chatq-q">{q.question}</div>

      {choice ? (
        <div className="chatq-opts">
          {(q.options || []).map((opt, i) => {
            let cls = 'chatq-opt';
            if (submitted) {
              if (i === q.answer_index) cls += ' correct';
              else if (i === selected) cls += ' wrong';
            } else if (i === selected) {
              cls += ' selected';
            }
            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={submitted}
                onClick={() => setSelected(i)}
              >
                <span className="chatq-opt-key">{String.fromCharCode(65 + i)}</span>
                <span>{opt}</span>
                {submitted && i === q.answer_index && <span className="chatq-mark">✓</span>}
                {submitted && i === selected && i !== q.answer_index && <span className="chatq-mark">✗</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="chatq-typed">
          <input
            className="chatq-input"
            type="text"
            placeholder="Type your answer…"
            value={text}
            disabled={submitted || busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
          />
        </div>
      )}

      {!submitted ? (
        <button
          className="chatq-submit"
          disabled={choice ? selected === null : (!text.trim() || busy)}
          onClick={choice ? submitChoice : submitTyped}
        >
          {busy ? 'Checking…' : 'Submit'}
        </button>
      ) : (
        <div className="chatq-feedback">
          <div className={`chatq-verdict ${ (choice ? choiceCorrect : result?.is_correct) ? 'ok' : 'no'}`}>
            {(choice ? choiceCorrect : result?.is_correct) ? '✓ Correct' : '✗ Not quite'}
          </div>
          {!choice && q.answer && (
            <div className="chatq-answer"><strong>Answer:</strong> {q.answer}</div>
          )}
          {!choice && result?.feedback && <div className="chatq-note">{result.feedback}</div>}
          {q.explanation && <div className="chatq-note">{q.explanation}</div>}
          <button className="chatq-again" onClick={onAskAnother}>🔁 Ask me another</button>
        </div>
      )}
    </div>
  );
}

function labelFor(t) {
  const f = FORMATS.find((x) => x.qtype === t);
  return f ? `${f.icon} ${f.label}` : 'Question';
}
