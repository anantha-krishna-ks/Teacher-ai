import Dropdown from './Dropdown';

const AVATARS = [
  {
    id: '/brunette.glb',
    name: 'Dr. Sofia',
    description: 'Ready Player Me — Default teacher',
    cameraTarget: '0m 1.62m 0m',
    cameraOrbit: '0deg 85deg 0.85m'
  },
  {
    id: '/avaturn.glb',
    name: 'Prof. Maya',
    description: 'Avaturn — Highly detailed model',
    cameraTarget: '0m 1.72m 0m',
    cameraOrbit: '0deg 85deg 0.85m'
  },
  {
    id: '/mpfb.glb',
    name: 'Ms. Priya',
    description: 'MPFB — Blender generated avatar',
    cameraTarget: '0m 1.65m 0m',
    cameraOrbit: '0deg 85deg 0.80m'
  },
  {
    id: '/avatarsdk.glb',
    name: 'Prof. Alex',
    description: 'AvatarSDK — AI generated avatar',
    cameraTarget: '0m 1.66m 0m',
    cameraOrbit: '0deg 85deg 0.85m'
  }
];

export default function AvatarSelectionScreen({
  onLogout,
  onSelectAvatar,
  currentAvatar,
  onEnterClassroom,
  selectedAccent,
  setSelectedAccent,
  catalog,
  selectedClass,
  setSelectedClass,
  selectedSubject,
  setSelectedSubject,
  selectedBookName,
  setSelectedBookName,
}) {
  const classOptions = catalog ? Object.keys(catalog) : [];
  const subjectOptions = selectedClass && catalog[selectedClass] ? Object.keys(catalog[selectedClass]) : [];
  const bookOptions = selectedClass && selectedSubject && catalog[selectedClass]?.[selectedSubject]
    ? catalog[selectedClass][selectedSubject] : [];

  const handleClassChange = (val) => {
    setSelectedClass(val);
    setSelectedSubject('');
    setSelectedBookName('');
  };

  const handleSubjectChange = (subject) => {
    setSelectedSubject(subject);
    const books = subject && catalog[selectedClass]?.[subject] ? catalog[selectedClass][subject] : [];
    setSelectedBookName(books.length === 1 ? books[0] : '');
  };

  const bookReady = selectedClass && selectedSubject && selectedBookName;
  // Class, Subject AND Chapter are all mandatory before a session can start.
  const canEnter = !!currentAvatar && !!bookReady;

  return (
    <div className="setup-screen theme-day" style={{ position: 'relative' }}>
      <button 
        onClick={onLogout} 
        title="Log Out"
        style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '24px', 
          background: 'var(--glass-bg)', 
          border: '1px solid var(--error-color)', 
          color: 'var(--error-color)', 
          padding: '8px 16px', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          fontSize: '13px', 
          fontWeight: '600',
          transition: 'all 0.2s',
          zIndex: 50,
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={e => { e.target.style.background = 'rgba(251, 113, 133, 0.1)'; }}
        onMouseLeave={e => { e.target.style.background = 'var(--glass-bg)'; }}
      >
        Logout
      </button>

      <div className="setup-panel">
        {/* Header */}
        <header className="setup-header">
          <span className="setup-eyebrow">✦ AI Learning Studio</span>
          <h1 className="setup-title">Set Up Your Learning Session</h1>
          <p className="setup-subtitle">
            Pick a textbook by class and subject, choose your AI teacher, and your session opens ready to go.
          </p>
        </header>

        {/* Step 1 — Chapter */}
        <section className="setup-block">
          <div className="block-label"><span className="step-num">1</span> Select your chapter</div>
          <div className="config-grid">
            <div className="config-field">
              <label>Class <span className="required-star">*</span></label>
              <Dropdown
                icon="🎓"
                placeholder="Select class…"
                value={selectedClass}
                options={classOptions.map(c => ({ value: c, label: c }))}
                onChange={handleClassChange}
              />
            </div>

            <div className="config-field">
              <label>Subject <span className="required-star">*</span></label>
              <Dropdown
                icon="📘"
                placeholder={selectedClass ? 'Select subject…' : 'Select a class first'}
                value={selectedSubject}
                disabled={!selectedClass}
                options={subjectOptions.map(s => ({ value: s, label: s }))}
                onChange={handleSubjectChange}
              />
            </div>

            <div className="config-field">
              <label>Chapter <span className="required-star">*</span></label>
              <Dropdown
                icon="📄"
                placeholder={selectedSubject ? 'Select chapter…' : 'Select a subject first'}
                value={selectedBookName}
                disabled={!selectedSubject}
                options={bookOptions.map(b => ({ value: b, label: b.replace(/\.pdf$/i, '') }))}
                onChange={setSelectedBookName}
              />
            </div>
          </div>

          {classOptions.length === 0 && (
            <p className="empty-hint">No chapters available in the library.</p>
          )}
        </section>

        {/* Step 2 — Teacher */}
        <section className="setup-block">
          <div className="block-head">
            <div className="block-label"><span className="step-num">2</span> Choose your AI teacher</div>
            <div className="accent-inline">
              <span className="accent-inline-label">Voice accent</span>
              <div className="pill-toggle" role="group" aria-label="Voice accent">
                <button type="button" className={`pill ${selectedAccent === 'US' ? 'is-active' : ''}`} onClick={() => setSelectedAccent('US')}>US English</button>
                <button type="button" className={`pill ${selectedAccent === 'IN' ? 'is-active' : ''}`} onClick={() => setSelectedAccent('IN')}>Indian English</button>
              </div>
            </div>
          </div>
          <div className="teacher-grid">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                className={`teacher-card ${currentAvatar === avatar.id ? 'is-selected' : ''}`}
                onClick={() => onSelectAvatar(avatar.id)}
                aria-pressed={currentAvatar === avatar.id}
              >
                <div className="teacher-stage">
                  {currentAvatar === avatar.id && <span className="teacher-selected-tag">Selected</span>}
                  <model-viewer
                    src={avatar.id}
                    alt={avatar.name}
                    camera-controls
                    disable-zoom
                    disable-pan
                    disable-tap
                    interaction-prompt="none"
                    camera-target={avatar.cameraTarget}
                    camera-orbit={avatar.cameraOrbit}
                    min-camera-orbit={avatar.cameraOrbit}
                    max-camera-orbit={avatar.cameraOrbit}
                    field-of-view="24deg"
                    style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                  />
                </div>
                <div className="teacher-meta">
                  <span className="teacher-name">{avatar.name}</span>
                  <span className="teacher-role">{avatar.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="setup-cta">
          <button className="enter-btn" disabled={!canEnter} onClick={() => onEnterClassroom(currentAvatar)}>
            Enter Classroom
            <span className="enter-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
