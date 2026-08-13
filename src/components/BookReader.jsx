import React from 'react';
import QuizPanel from './QuizPanel';
import HomeworkPanel from './HomeworkPanel';
import LearningOutcomesBanner from './LearningOutcomesBanner';
import Dropdown from './Dropdown';
import { apiUrl } from '../config';
import { LANGUAGE_OPTIONS } from '../languages';

const STYLE_OPTIONS = [
  { value: 'Simple', label: 'Simple' },
  { value: 'Detailed', label: 'Detailed' },
  { value: 'Step-by-Step', label: 'Step-by-Step' },
  { value: 'Storytelling', label: 'Storytelling' },
  { value: 'Exam Focused', label: 'Exam Focused' },
];
const QUESTION_OPTIONS = [
  { value: 3, label: '3 Questions' },
  { value: 5, label: '5 Questions' },
  { value: 10, label: '10 Questions' },
];

export default function BookReader({
  onBack,
  onLogout,
  locked = false,
  currentBook,
  currentPageText,
  currentPage,
  totalPages,
  onPageChange,
  onTeachPage,
  onGenerateQuizClick,
  onGenerateHomeworkClick,
  isGeneratingHomework,
  activeHomework,
  setActiveHomework,
  onPocketNotes,
  isGeneratingNotes,
  onFetchVideos,
  isLoadingVideos,
  selectedStyle,
  setSelectedStyle,
  numQuestions,
  setNumQuestions,
  isExplaining,
  isGeneratingQuiz,
  workspaceMode,
  setWorkspaceMode,
  activeQuiz,
  setActiveQuiz,
  onQuizSubmit,
  teachingLanguage,
  setTeachingLanguage,
  llmProvider,
  isVisionActive,
  setIsVisionActive,
  showVisionPreview,
  setShowVisionPreview,
  chapterLOs,
  isLoadingLOs,
  showLOBanner,
  setShowLOBanner,
  onPlayAvatarBriefing,
  onOpenLOModal,
}) {
  return (
    <div className="left-pane">
      {/* ── Header ── */}
      <header className="reader-header">
        {/* Left Controls & Logo */}
        <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onBack}
            disabled={locked}
            title={locked ? "End the teacher call first" : "Back to Dashboard"}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: locked ? 'not-allowed' : 'pointer',
              opacity: locked ? 0.4 : 1,
              color: 'var(--text-main)',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => { if (!locked) e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="logo-mark">🎓</span>
            <div className="logo-icon">Teacher AI</div>
          </div>
          {currentBook && (
            <span className="book-title" title={currentBook.title} style={{ marginLeft: '1rem' }}>{currentBook.title}</span>
          )}
        </div>

        {/* Right side controls */}
        <div className="reader-header-controls">
          {/* Only show controls after book loaded */}
          {currentBook && (
            <div className="reader-controls">
              <Dropdown
                compact
                icon="✨"
                value={selectedStyle}
                options={STYLE_OPTIONS}
                onChange={setSelectedStyle}
                disabled={locked}
              />
              <Dropdown
                compact
                icon="🌐"
                value={teachingLanguage}
                options={LANGUAGE_OPTIONS}
                onChange={setTeachingLanguage}
                disabled={locked}
              />
              <Dropdown
                compact
                icon="📝"
                value={numQuestions}
                options={QUESTION_OPTIONS}
                onChange={setNumQuestions}
                disabled={locked}
              />
              <button
                className="control-btn"
                onClick={onOpenLOModal}
                disabled={locked}
                title="View Chapter Objectives, Learning Outcomes & Orientation"
              >
                🎯 Objectives & LOs
              </button>
              <button
                className="control-btn primary"
                onClick={onTeachPage}
                disabled={isExplaining || locked}
                title="Explain the current page"
              >
                {isExplaining ? "Explaining…" : "🎓 Teach Me Page"}
              </button>
              <button
                className="control-btn success"
                onClick={onGenerateQuizClick}
                disabled={isGeneratingQuiz || !!activeQuiz || locked}
              >
                {isGeneratingQuiz ? "Generating…" : "📝 Quiz"}
              </button>
              <button
                className="control-btn"
                onClick={onGenerateHomeworkClick}
                disabled={isGeneratingHomework || locked}
                title="Generate written homework, then grade a photo of the answers"
              >
                {isGeneratingHomework ? "Generating…" : "📄 Homework"}
              </button>
              <button
                className="control-btn"
                onClick={onPocketNotes}
                disabled={isGeneratingNotes || locked}
                title="Quick revision notes for this page"
              >
                {isGeneratingNotes ? "Writing…" : "🗂️ Notes"}
              </button>

              <button
                className="control-btn"
                onClick={onFetchVideos}
                disabled={isLoadingVideos || locked}
                title="Find related YouTube videos for this chapter"
              >
                {isLoadingVideos ? "Finding…" : "📺 Videos"}
              </button>

              {/* Attention Guard — turns the webcam on so the lesson pauses when
                  the student looks away. Everything runs on-device; no frame
                  ever leaves the browser. */}
              <button
                className={`control-btn${isVisionActive ? ' success' : ''}`}
                onClick={() => setIsVisionActive(!isVisionActive)}
                disabled={locked}
                title={isVisionActive
                  ? "Attention Guard is ON — click to turn the camera off"
                  : "Attention Guard: pause the lesson if you look away (uses your webcam, on-device only)"}
              >
                {isVisionActive ? "👁️ Guard ON" : "👁️ Guard OFF"}
              </button>

              {/* Show/hide the little camera preview while the guard is running. */}
              {isVisionActive && (
                <button
                  className="control-btn"
                  onClick={() => setShowVisionPreview(!showVisionPreview)}
                  disabled={locked}
                  title={showVisionPreview ? "Hide the camera preview" : "Show the camera preview"}
                >
                  {showVisionPreview ? "🙈 Hide Cam" : "📹 Show Cam"}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="page-viewer-content">
        {!currentBook ? (
          /* Loading placeholder — a book is always selected before entering the classroom,
             so this only shows briefly while the chosen chapter is being loaded. */
          <div className="upload-zone" style={{ cursor: 'default' }}>
            <div className="upload-icon">📚</div>
            <h3>Preparing your textbook…</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading the chapter you selected. This will just take a moment.</p>
            
          </div>
        ) : workspaceMode === 'quiz' && activeQuiz ? (
          /* Quiz Mode */
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-main)', fontSize: '20px' }}>
                📝 Pop Quiz — Page {currentPage}
              </h2>
              <button className="control-btn" onClick={() => setWorkspaceMode('pdf')}>
                Back to PDF 📖
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <QuizPanel
                questions={activeQuiz}
                llmProvider={llmProvider}
                onResetQuiz={() => { setActiveQuiz(null); setWorkspaceMode('pdf'); }}
                onSubmitAnswers={onQuizSubmit}
              />
            </div>
          </div>
        ) : workspaceMode === 'homework' && activeHomework ? (
          /* Homework Mode */
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-main)', fontSize: '20px' }}>
                📄 Homework — Page {currentPage}
              </h2>
              <button className="control-btn" onClick={() => setWorkspaceMode('pdf')}>
                Back to PDF 📖
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <HomeworkPanel
                questions={activeHomework}
                language={teachingLanguage}
                onReset={() => { setActiveHomework(null); setWorkspaceMode('pdf'); }}
              />
            </div>
          </div>
        ) : (
          /* PDF Viewer */
          <div className="pdf-frame-wrap" onContextMenu={(e) => e.preventDefault()}>
            {(activeQuiz || activeHomework) && workspaceMode === 'pdf' && !locked && (
              <div className="resume-fabs-container">
                {activeQuiz && (
                  <button className="resume-quiz-fab" onClick={() => setWorkspaceMode('quiz')}>
                    📝 Resume Active Quiz
                  </button>
                )}
                {activeHomework && (
                  <button className="resume-quiz-fab" onClick={() => setWorkspaceMode('homework')}>
                    📄 Resume Homework
                  </button>
                )}
              </div>
            )}
            <iframe
              src={`${apiUrl(`/books/${currentBook.book_id}/pdf/pages/${currentPage}`)}#toolbar=0&navpanes=0`}
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              key={`${currentBook.book_id}-${currentPage}`}
            />
          </div>
        )}
      </main>

      {/* ── Page Navigation Footer ── */}
      {currentBook && workspaceMode !== 'quiz' && workspaceMode !== 'homework' && (
        <footer className="page-footer">
          {locked ? (
            /* During a teacher call: keep the current page visible but lock navigation. */
            <div className="call-lock-note">
              🔒 On page {currentPage} of {totalPages} · page controls are paused during your teacher call
            </div>
          ) : (
            <>
              <button className="control-btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
                ‹ Prev
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page</span>
                <input
                  type="number" min="1" max={totalPages} value={currentPage}
                  className="page-number-input"
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) onPageChange(v); }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>of {totalPages}</span>
              </div>
              <button className="control-btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
                Next ›
              </button>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
