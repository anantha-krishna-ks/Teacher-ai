import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import BookReader from './components/BookReader';
import AvatarCanvas from './components/AvatarCanvas';
import LiveInteractButton from './components/LiveInteractButton';
import AvatarSelectionScreen from './components/AvatarSelectionScreen';
import LoginScreen from './components/LoginScreen';
import TeacherVoiceModal from './components/TeacherVoiceModal';
import HomeworkSetupModal from './components/HomeworkSetupModal';
import LearningOutcomesModal from './components/LearningOutcomesModal';
import MediaPipeVision from './components/MediaPipeVision';
import { ChatFollowUps, ChatQuestionCard } from './components/ChatQuiz';
import { apiUrl, ENDPOINTS } from './config';
import { sttCodeFor, azureVoiceFor } from './languages';
import { prefetchTts, isTtsReady } from './ttsCache';
import { playAttentionNudge, stopNudge, resetNudgeRotation } from './attentionAudio';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import './index.css';

// Inline styles for chat cards (pocket notes, reference videos) — keeps index.css lean.
function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : url;
}
const S = {
  notesCard: { border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, overflow: 'hidden', background: 'var(--card-bg, #fff)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  notesHeader: { background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '8px 14px', letterSpacing: 0.3 },
  notesBody: { padding: '4px 14px 10px', fontSize: 14, lineHeight: 1.5 },
  videosCard: { border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, overflow: 'hidden', background: 'var(--card-bg, #fff)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  videosHeader: { background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '8px 14px', letterSpacing: 0.3 },
  videoRow: { display: 'flex', gap: 10, padding: '10px 12px', textDecoration: 'none', color: 'inherit', borderTop: '1px solid var(--border, #eef2f7)' },
  videoThumb: { width: 96, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#e2e8f0' },
  videoTitle: { fontSize: 13, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  videoMeta: { fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 4 },
  figuresCard: { border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, overflow: 'hidden', background: 'var(--card-bg, #fff)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  figuresHeader: { background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontWeight: 700, fontSize: 13, padding: '8px 14px', letterSpacing: 0.3 },
  figuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, padding: 12 },
  figureCard: { border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-tertiary, #f8fafc)' },
  figureImg: { width: '100%', maxHeight: 150, objectFit: 'contain', background: '#0f172a', display: 'block' },
  figureCaption: { fontSize: 11, color: 'var(--text-muted, #64748b)', textAlign: 'center', padding: '6px 8px' },
};

export default function App() {
  // ── Book State ──
  const [currentBook, setCurrentBook] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageText, setCurrentPageText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Simple");

  // ── Catalog / Dropdown State ──
  const [catalog, setCatalog] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBookName, setSelectedBookName] = useState('');

  // ── Interaction State ──
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [textToSpeak, setTextToSpeak] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGeneratingHomework, setIsGeneratingHomework] = useState(false);
  const [showHomeworkSetup, setShowHomeworkSetup] = useState(false);
  const [activeHomework, setActiveHomework] = useState(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState(null);
  const [activeImageModal, setActiveImageModal] = useState(null);  // zoomed textbook figure
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [showLOModal, setShowLOModal] = useState(false);
  const [chapterLOs, setChapterLOs] = useState(null);
  const [isLoadingLOs, setIsLoadingLOs] = useState(false);
  const [allowManualLOModalClose, setAllowManualLOModalClose] = useState(false);
  const [loPhase, setLoPhase] = useState('outcomes');   // which step the orientation loader is on
  const [loVoiceReady, setLoVoiceReady] = useState(false); // the spoken briefing audio is downloaded
  const [workspaceMode, setWorkspaceMode] = useState("pdf");
  const [isPaused, setIsPaused] = useState(false);
  const [teachingLanguage, setTeachingLanguage] = useState("English");
  // LLM provider is fixed to Google Gemini — no user-facing selector.
  const [llmProvider] = useState("gemini");
  const [appView, setAppView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState("/brunette.glb");
  const [selectedAccent, setSelectedAccent] = useState("US");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");  // homework difficulty: Easy | Medium | Hard
  const [currentSpokenWordIndex, setCurrentSpokenWordIndex] = useState(-1);
  const [isFullScreenLoading, setIsFullScreenLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState({
    title: "Preparing Explanation…",
    subtitle: "Please give me a moment",
    emoji: "🎓"
  });

  const showLoader = (title, subtitle, emoji = "🎓") => {
    setLoadingConfig({ title, subtitle, emoji });
    setIsFullScreenLoading(true);
  };
  const hideLoader = () => {
    setIsFullScreenLoading(false);
  };
  const [isQGenerating, setIsQGenerating] = useState(false);   // generating an in-chat practice question

  // ── Live Interact ──
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLiveProcessing, setIsLiveProcessing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  // ── Ask the Teacher (voice-only Gemini Live) ──
  const [teacherOpen, setTeacherOpen] = useState(false);

  // ── MediaPipe Vision Guard & Gestures ──
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [showVisionPreview, setShowVisionPreview] = useState(true);
  const [visionFocusScore, setVisionFocusScore] = useState(100);

  // ── Attention Guard ──
  // When the student looks away for 5s while the avatar is explaining, the lesson
  // PAUSES, a local nudge clip plays, and a blocking overlay waits for the student
  // to press Resume. There is deliberately no auto-resume: simply glancing back
  // must not restart the lesson, otherwise the guard is trivial to ignore.
  const [attentionAlert, setAttentionAlert] = useState(null);   // { reason, at } | null
  const [attentionCooldown, setAttentionCooldown] = useState(false);
  const [visionStats, setVisionStats] = useState({ distractions: 0, awaySeconds: 0 });
  const [distractionCount, setDistractionCount] = useState(0);  // strikes this login session
  const [sessionEnded, setSessionEnded] = useState(false);      // final strike -> logging out
  const [logoutIn, setLogoutIn] = useState(0);                  // seconds left on that countdown
  const attentionArmedRef = useRef(false);
  const cooldownTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const distractionCountRef = useRef(0);
  const teachingLanguageRef = useRef("English");   // read by the nudge player (not a render dep)
  const avatarGenderRef = useRef("female");        // ditto — picks the nudge voice

  // Give the student a moment to settle back in before the guard can fire again.
  const ATTENTION_COOLDOWN_MS = 10000;

  // Strikes: each of the first MAX_WARNINGS distractions gets a spoken warning of
  // escalating harshness (one clip each). The NEXT one ends the session — a
  // student who has ignored every warning is not learning, so the lesson closes
  // and they are logged out rather than left to idle in front of the avatar.
  const MAX_WARNINGS = 4;                  // = number of nudge clips
  const LOGOUT_COUNTDOWN_SEC = 10;

  const handleAttentionLost = useCallback((reason = 'looking_away') => {
    // The detector only fires when armed, but re-check: state can change in the
    // milliseconds between the camera frame and this callback.
    if (!attentionArmedRef.current) return;

    const strike = distractionCountRef.current + 1;
    distractionCountRef.current = strike;
    setDistractionCount(strike);
    setIsPaused(true);                       // AvatarCanvas → TalkingHead.stop()

    if (strike > MAX_WARNINGS) {
      // Out of warnings — end the session.
      setAttentionAlert(null);
      setSessionEnded(true);
      setLogoutIn(LOGOUT_COUNTDOWN_SEC);
      // Sign off with the harshest clip so the last thing heard matches the outcome.
      playAttentionNudge(teachingLanguageRef.current, avatarGenderRef.current, MAX_WARNINGS);
      return;
    }

    setAttentionAlert({ reason, at: Date.now(), strike });
    // Spoken in the teaching avatar's own voice; clip N matches strike N, so the
    // warning gets harsher exactly in step with the count shown on screen.
    // TalkingHead's AudioContext is suspended right now, which is precisely why
    // this plays through a separate Audio element.
    playAttentionNudge(teachingLanguageRef.current, avatarGenderRef.current, strike);
  }, []);

  const handleResumeAfterAttention = useCallback(() => {
    stopNudge();
    setAttentionAlert(null);
    setIsPaused(false);                      // AvatarCanvas → TalkingHead.start()
    setAttentionCooldown(true);
    clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => setAttentionCooldown(false), ATTENTION_COOLDOWN_MS);
  }, []);

  useEffect(() => () => {
    clearTimeout(cooldownTimerRef.current);
    clearInterval(logoutTimerRef.current);
    stopNudge();
  }, []);

  // Final-strike countdown. Ticks once a second, then signs the student out.
  // handleLogout is defined further down, so it is reached through a ref-free
  // dependency on `sessionEnded` only — the effect re-reads the latest closure.
  useEffect(() => {
    if (!sessionEnded) return;
    logoutTimerRef.current = setInterval(() => {
      setLogoutIn((prev) => {
        if (prev <= 1) {
          clearInterval(logoutTimerRef.current);
          endSessionNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(logoutTimerRef.current);
  }, [sessionEnded]);

  // If the lesson ends (or is cleared for a quiz / call) while the overlay is up,
  // drop the alert — there is nothing left to resume.
  useEffect(() => {
    if (attentionAlert && !textToSpeak) { stopNudge(); setAttentionAlert(null); }
  }, [textToSpeak, attentionAlert]);

  const handleGesture = useCallback((gestureType) => {
    // Ignore gesture inputs during loading states, page explanations, quiz/homework generations, or active modals
    if (isFullScreenLoading || isExplaining || isGeneratingQuiz || isGeneratingHomework || isGeneratingNotes || isLoadingVideos || showLOModal) {
      return;
    }

    if (gestureType === 'raise_hand') {
      if (teacherOpen) {
        // Raise hand while call is active -> CUT / END the call
        setTeacherOpen(false);
        setTextToSpeak("");
      } else if (currentBook) {
        // Raise hand while call is inactive -> START the call
        setTeacherOpen(true);
      }
    } else if (gestureType === 'thumbs_up') {
      // Thumbs up -> Go to NEXT page silently
      setCurrentPage(prev => {
        const next = prev + 1;
        const maxPages = currentBook?.total_pages || 100;
        return next <= maxPages ? next : prev;
      });
    } else if (gestureType === 'thumbs_down') {
      // Thumbs down -> Go to PREVIOUS page silently
      setCurrentPage(prev => {
        const prevPage = prev - 1;
        return prevPage >= 1 ? prevPage : prev;
      });
    } else if (gestureType === 'next_page') {
      setCurrentPage(prev => {
        const next = prev + 1;
        const maxPages = currentBook?.total_pages || 100;
        return next <= maxPages ? next : prev;
      });
    }
  }, [teacherOpen, currentBook, isFullScreenLoading, isExplaining, isGeneratingQuiz, isGeneratingHomework, isGeneratingNotes, isLoadingVideos, showLOModal]);

  // ── Refs ──
  const recognitionRef = useRef(null);
  const listenTimerRef = useRef(null);   // single pending "start listening" timer
  const liveModeRef = useRef(false);
  const currentPageTextRef = useRef("");
  const currentBookRef = useRef(null);
  const currentPageRef = useRef(1);
  const chatEndRef = useRef(null);
  const avatarRef = useRef(null);
  const hasGreetedLiveRef = useRef(false);
  const liveTranscriptRef = useRef("");
  const speechEndFiredRef = useRef(false);  // dedupe end-of-speech signal per utterance
  const messagesRef = useRef([]);
  const askedQuestionsRef = useRef([]);   // in-chat question texts already asked (avoid repeats)
  const lastExplanationRef = useRef("");  // most recent page explanation (grounds practice questions)
  const questionIdRef = useRef(0);        // stable ids for question cards so dedupe never remounts them
  const loRequestRef = useRef(0);         // guards a late briefing-voice prefetch against a newer chapter
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);

  // ── Sync refs ──
  useEffect(() => { currentPageTextRef.current = currentPageText; }, [currentPageText]);
  useEffect(() => { currentBookRef.current = currentBook; }, [currentBook]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript]);
  useEffect(() => { setCurrentSpokenWordIndex(-1); speechEndFiredRef.current = false; }, [textToSpeak]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, currentSpokenWordIndex]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { teachingLanguageRef.current = teachingLanguage; }, [teachingLanguage]);
  useEffect(() => {
    avatarGenderRef.current = selectedAvatar === '/avatarsdk.glb' ? 'male' : 'female';
  }, [selectedAvatar]);

  // ── Fetch Catalog ──
  useEffect(() => {
    if (!currentUser) {
      setCatalog({});
      return;
    }
    const tenantParam = currentUser.tenant ? `?tenant=${encodeURIComponent(currentUser.tenant)}` : '';
    fetch(apiUrl(ENDPOINTS.catalog + tenantParam))
      .then(r => r.ok ? r.json() : {})
      .then(data => setCatalog(data))
      .catch(() => setCatalog({}));
  }, [currentUser]);

  // ── Load Page Text ──
  useEffect(() => {
    if (!currentBook) return;
    fetch(apiUrl(`/books/${currentBook.book_id}/pages/${currentPage}`))
      .then(r => r.ok ? r.json() : { content: "Error loading page." })
      .then(data => setCurrentPageText(data.content))
      .catch(() => setCurrentPageText("Error loading page content."));
  }, [currentBook, currentPage]);

  // ── Fetch Chapter Objectives & Learning Outcomes ──
  // ONE loading pass covers both halves of the orientation: the outcomes text AND
  // the avatar's spoken briefing audio. Azure TTS for a 40-second script takes a
  // few seconds, so it is downloaded here — while the loader is already on screen —
  // instead of when the student clicks "Start Chapter Lesson". By the time that
  // button appears the voice is cached, so the avatar starts talking immediately.
  const fetchLearningOutcomes = useCallback(async (bookId, autoOpen = true, avatarOverride = '') => {
    if (!bookId) return;
    const myRequest = ++loRequestRef.current;
    setIsLoadingLOs(true);
    setLoPhase('outcomes');
    setLoVoiceReady(false);
    if (autoOpen) setShowLOModal(true);
    try {
      const res = await fetch(apiUrl(ENDPOINTS.learningOutcomes), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, language: teachingLanguage, llm_provider: llmProvider }),
      });
      if (!res.ok) throw new Error('Failed to fetch learning outcomes');
      const data = await res.json();
      setChapterLOs(data);

      // Step 2 of the same wait: pre-render the briefing voice.
      const intro = data?.avatar_intro;
      if (intro) {
        setLoPhase('voice');
        // Entering the classroom sets the avatar and loads the book in the same tick,
        // so `selectedAvatar` is still the previous value here — use the id we were
        // handed. Getting this wrong would prefetch the wrong-gender voice and the
        // cache would miss on click.
        const avatar = avatarOverride || selectedAvatar;
        const gender = avatar === '/avatarsdk.glb' ? 'male' : 'female';
        const { voiceName } = azureVoiceFor(teachingLanguage, gender, selectedAccent);

        // Never trap the student behind a slow/hung TTS call: past the cap we show
        // the card anyway. The request stays alive in the cache, so clicking Start
        // reuses it rather than firing a second one — and the footer chip flips to
        // "ready" on its own if the audio lands after the cap.
        const pending = prefetchTts(intro, voiceName);
        await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, 15000))]);
        if (loRequestRef.current === myRequest) setLoVoiceReady(isTtsReady(intro, voiceName));
        pending.then((ok) => {
          if (ok && loRequestRef.current === myRequest) setLoVoiceReady(true);
        });
      }
    } catch (err) {
      console.error("Error fetching learning outcomes:", err);
      // The orientation is what the avatar was holding its greeting for, so a failure
      // must not leave the student staring at an empty overlay with a silent teacher.
      if (loRequestRef.current === myRequest) {
        setShowLOModal(false);
        const fallback = "Your chapter is ready. Pick a page and I'll start teaching whenever you are.";
        setMessages(prev => [...prev, { role: 'bot', content: fallback }]);
        setTextToSpeak(fallback);
      }
    } finally {
      setIsLoadingLOs(false);
      setLoPhase('outcomes');
    }
  }, [teachingLanguage, llmProvider, selectedAvatar, selectedAccent]);

  // ── Load a textbook from the BOOKS/ library (Class → Subject → file) ──
  const loadCatalogBook = useCallback(async (className, subject, filename, avatarOverride = '') => {
    try {
      const tenant = currentUser?.tenant || '';
      const res = await fetch(apiUrl(ENDPOINTS.loadBook), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className, subject, filename, tenant })
      });
      if (!res.ok) throw new Error('Failed to load book');
      const data = await res.json();
      const welcomeText = `I have loaded **${data.title}**. Select a page and click 'Teach Me Page' to begin!`;
      setCurrentBook({ book_id: data.book_id, title: data.title, total_pages: data.total_pages });
      setCurrentPage(1);
      setWorkspaceMode("pdf");
      setActiveQuiz(null);
      setChapterLOs(null);
      setAllowManualLOModalClose(false);
      setMessages([{ role: 'bot', content: welcomeText }]);
      setIsPaused(false);
      setTextToSpeak(""); // Don't speak welcomeText so avatar waits for orientation briefing!
      fetchLearningOutcomes(data.book_id, true, avatarOverride);
      return true;
    } catch (err) {
      alert("Error loading book: " + err.message);
      return false;
    }
  }, [currentUser, fetchLearningOutcomes]);

  // Dashboard "Enter Classroom": load the chosen book (if any), then open the classroom
  const handleEnterClassroom = useCallback((avatarId) => {
    // Unconditionally unlock browser audio context by playing a brief silent beep synchronously
    // We keep this context alive globally so the document remains unlocked for the Avatar's AudioContext later.
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !window.__unlockedAudioContext) {
        const tempCtx = new AudioContextClass();
        const osc = tempCtx.createOscillator();
        const gain = tempCtx.createGain();
        gain.gain.value = 0.0001; // extremely silent
        osc.connect(gain);
        gain.connect(tempCtx.destination);
        osc.start(0);
        osc.stop(0.1); 
        tempCtx.resume();
        window.__unlockedAudioContext = tempCtx;
      }
    } catch (_) {}

    if (avatarId) setSelectedAvatar(avatarId);
    
    // Transition to the classroom synchronously inside the user's click gesture frame
    // to guarantee the newly mounted Avatar Canvas AudioContext is successfully resumed!
    setAppView("classroom");

    // Load the catalog book asynchronously in the background
    if (selectedClass && selectedSubject && selectedBookName) {
      // Pass the just-chosen avatar so the briefing voice is prefetched for the
      // right gender (setSelectedAvatar above hasn't landed in state yet).
      loadCatalogBook(selectedClass, selectedSubject, selectedBookName, avatarId || selectedAvatar);
    }
  }, [loadCatalogBook, selectedClass, selectedSubject, selectedBookName, selectedAvatar]);

  // ── Live Interact ──
  const stopRecognition = useCallback(() => {
    if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch (_) {} recognitionRef.current = null; }
    setIsListening(false);
    setLiveTranscript("");
  }, []);

  const startListening = useCallback((pageText, book) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Live Interact requires Chrome or Edge browser."); return; }
    if (!liveModeRef.current) return;
    stopRecognition();
    const recognition = new SpeechRecognition();
    recognition.lang = sttCodeFor(teachingLanguage);
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => { setIsListening(true); setLiveTranscript(""); };
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setLiveTranscript(transcript);
    };
    // Schedule the next listen through a SINGLE tracked timer (so onerror + onend can
    // never queue two competing recognitions that abort each other).
    const scheduleListen = (delay) => {
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
      listenTimerRef.current = setTimeout(() => {
        listenTimerRef.current = null;
        if (liveModeRef.current) startListening(currentPageTextRef.current, currentBookRef.current);
      }, delay);
    };
    recognition.onerror = (e) => {
      // Terminal mic errors: stop live mode and tell the user instead of retry-looping.
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        liveModeRef.current = false;
        setIsLiveMode(false);
        stopRecognition();
        alert("Microphone access is blocked. Please allow microphone permission in your browser to use Live Interact.");
        return;
      }
      // 'no-speech' (and other transient errors) are ALWAYS followed by onend, which owns
      // the single retry — do NOT reschedule here or two recognitions would race.
    };
    recognition.onend = async () => {
      setIsListening(false);
      const transcript = liveTranscriptRef.current.trim();
      setLiveTranscript("");
      if (!liveModeRef.current) return;
      if (!transcript) { scheduleListen(300); return; }
      setIsLiveProcessing(true);
      setTextToSpeak("");
      setMessages(prev => [...prev, { role: 'user', content: `🎙 ${transcript}` }]);
      try {
        const book = currentBookRef.current;
        // Answer from the current page + relevant content across the whole chapter.
        const res = await fetch(apiUrl(ENDPOINTS.askChapter), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_id: book.book_id, question: transcript, page_number: currentPageRef.current, language: teachingLanguage, llm_provider: llmProvider, history: messagesRef.current })
        });
        const data = await res.json();
        if (!liveModeRef.current) return;   // stop landed during the fetch — stay silent
        const answer = data.explanation || "Sorry, I could not understand that.";
        setMessages(prev => [...prev, { role: 'bot', content: answer }]);
        setTextToSpeak(answer);
        // Show the book's own diagrams/figures relevant to this answer, if any.
        if (Array.isArray(data.images) && data.images.length > 0) {
          setMessages(prev => [...prev, { role: 'bot', type: 'figures', images: data.images }]);
        }
      } catch {
        if (!liveModeRef.current) return;
        const errMsg = "Sorry, there was an error processing your question.";
        setMessages(prev => [...prev, { role: 'bot', content: errMsg }]);
        setTextToSpeak(errMsg);
      } finally {
        setIsLiveProcessing(false);
      }
    };
    recognition.start();
  }, [stopRecognition, teachingLanguage, llmProvider]);

  const handleSpeechEnd = useCallback(() => {
    if (speechEndFiredRef.current) return;   // fire once per utterance
    speechEndFiredRef.current = true;
    setCurrentSpokenWordIndex(999999);
    if (!liveModeRef.current) return;
    // Brief gap so the avatar's audio tail doesn't echo into the mic, then listen.
    // Uses the single tracked timer so turning Live off cancels it.
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    listenTimerRef.current = setTimeout(() => {
      listenTimerRef.current = null;
      if (liveModeRef.current) startListening(currentPageTextRef.current, currentBookRef.current);
    }, 500);
  }, [startListening]);

  const handleSpeechStart = useCallback((text, isError = false) => {
    setIsExplaining(false);
    setIsGeneratingQuiz(false);
    setIsFullScreenLoading(false);
  }, []);

  // Poll the avatar only to drive the playback slider. End-of-speech is signalled
  // reliably by AvatarCanvas via onSpeechEnd (which watches TalkingHead.isSpeaking).
  useEffect(() => {
    let interval;
    if (textToSpeak && !isPaused) {
      interval = setInterval(() => {
        if (avatarRef.current) {
          setCurrentTimeMs(avatarRef.current.getCurrentTimeMs());
          setTotalTimeMs(avatarRef.current.getTotalDurationMs());
        }
      }, 250);
    }
    return () => clearInterval(interval);
  }, [textToSpeak, isPaused]);

  const handleLiveModeToggle = useCallback(() => {
    // ── Turn OFF ──
    if (liveModeRef.current) {
      liveModeRef.current = false; setIsLiveMode(false); stopRecognition(); setTextToSpeak(""); setIsLiveProcessing(false);
      return;
    }

    // ── Turn ON ──
    if (!currentBookRef.current) return;

    // Grant microphone permission inside this user-gesture so later, timer-driven
    // recognition.start() calls (after the greeting/answer) aren't blocked.
    try {
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then(stream => stream.getTracks().forEach(t => t.stop()))
        .catch(() => {});
    } catch (_) {}

    liveModeRef.current = true; setIsLiveMode(true); setIsPaused(false);

    if (!hasGreetedLiveRef.current) {
      hasGreetedLiveRef.current = true;
      const greeting = "Hi! I'm your AI study coach. Go ahead — ask me anything about this page!";
      setMessages(prev => [...prev, { role: 'bot', content: greeting }]);
      setTextToSpeak(greeting);
      // When the greeting finishes, AvatarCanvas.onSpeechEnd → handleSpeechEnd starts listening.
    } else {
      startListening(currentPageTextRef.current, currentBookRef.current);
    }
  }, [stopRecognition, startListening]);

  useEffect(() => () => { liveModeRef.current = false; stopRecognition(); }, [stopRecognition]);

  // ── In-chat practice questions ──
  // Show the "test yourself" format chips (MCQ / Fill-in / True-False / Short answer).
  // Keep EXACTLY ONE chip card, always at the bottom — clicking "Ask me another" any number
  // of times just refreshes that single card instead of stacking duplicates.
  const offerFollowUps = useCallback(() => {
    setMessages(prev => [...prev.filter(m => m.type !== 'actions'), { role: 'bot', type: 'actions' }]);
  }, []);

  // Fetch one question of the chosen type and render it as an interactive chat card.
  const generateChatQuestion = useCallback(async (qtype) => {
    if (!currentBook || isQGenerating) return;
    setIsQGenerating(true);
    const qid = ++questionIdRef.current;   // stable key so later dedupes never remount this card
    setMessages(prev => [...prev, { role: 'bot', type: 'question', loading: true, id: qid, data: { type: qtype } }]);
    try {
      const res = await fetch(apiUrl(ENDPOINTS.question), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: currentBook.book_id,
          page_number: currentPage,
          explanation: lastExplanationRef.current,
          qtype,
          language: teachingLanguage,
          llm_provider: llmProvider,
          avoid: askedQuestionsRef.current.slice(-8),
        })
      });
      if (!res.ok) throw new Error('Failed to generate question');
      const q = await res.json();
      if (q && q.question) askedQuestionsRef.current.push(q.question);
      setMessages(prev => prev.map(m =>
        (m.type === 'question' && m.loading && m.id === qid)
          ? { role: 'bot', type: 'question', id: qid, data: q }
          : m
      ));
    } catch {
      setMessages(prev => [
        ...prev.filter(m => !(m.type === 'question' && m.loading && m.id === qid)),
        { role: 'bot', content: 'Sorry, I could not create that question. Please try again.' },
      ]);
    } finally {
      setIsQGenerating(false);
    }
  }, [currentBook, currentPage, teachingLanguage, llmProvider, isQGenerating]);

  // ── Handlers ──
  const handleTeachPage = async () => {
    if (!currentBook || isExplaining) return;
    setIsPaused(false); setIsExplaining(true); setCurrentSpokenWordIndex(-1);
    setAttentionAlert(null);   // clear a stale warning; strikes persist for the whole session
    showLoader("Preparing Explanation…", "Please give me a moment", "🎓");
    setTextToSpeak("");
    setMessages(prev => [...prev, { role: 'user', content: `Please explain page ${currentPage} using ${selectedStyle} style.` }]);
    try {
      const res = await fetch(apiUrl(ENDPOINTS.explain), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: currentBook.book_id, page_number: currentPage, style: selectedStyle, language: teachingLanguage, llm_provider: llmProvider })
      });
      if (!res.ok) throw new Error("Explanation request failed");
      const data = await res.json();
      lastExplanationRef.current = data.explanation;
      setMessages(prev => [...prev, { role: 'bot', content: data.explanation }]);
      setCurrentSpokenWordIndex(-1);
      setTextToSpeak(data.explanation);
      // After the full page is explained, invite the student to test themselves.
      offerFollowUps();
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: `Error: ${err.message}` }]);
      setIsExplaining(false);
      hideLoader();
    }
  };

  const handleGenerateQuiz = async () => {
    if (!currentBook || isGeneratingQuiz || activeQuiz) return;
    setIsPaused(false); setIsGeneratingQuiz(true);
    showLoader("Generating Quiz…", "Get ready to test your understanding!", "📝");
    setTextToSpeak("");
    const lastBotMsg = [...messages].reverse().find(m => m.role === 'bot');
    const lastExplanation = lastBotMsg ? lastBotMsg.content : "";
    try {
      const res = await fetch(apiUrl(ENDPOINTS.quiz), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: currentBook.book_id, page_number: currentPage, explanation: lastExplanation, num_questions: numQuestions, language: teachingLanguage, llm_provider: llmProvider })
      });
      if (!res.ok) throw new Error("Quiz generation failed");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setActiveQuiz(data); setWorkspaceMode("quiz");
        const msg = "I have prepared a short quiz based on this page's concepts. Let's test your understanding!";
        setMessages(prev => [...prev, { role: 'bot', content: msg }]);
        setTextToSpeak(msg);
      } else {
        alert("The model couldn't generate a quiz for this page's content.");
        setIsGeneratingQuiz(false);
        hideLoader();
      }
    } catch (err) {
      alert("Error generating quiz: " + err.message);
      setIsGeneratingQuiz(false);
      hideLoader();
    }
  };

  // Generate written homework from the current page. The student then uploads a
  // photo of their handwritten answers, which is graded against the rubric.
  const handleGenerateHomework = async (question_mix) => {
    if (!currentBook || isGeneratingHomework) return;
    setIsPaused(false); setIsGeneratingHomework(true);
    showLoader("Generating Homework…", "Creating questions from this page", "📄");
    setTextToSpeak("");
    try {
      const res = await fetch(apiUrl(ENDPOINTS.homework), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: currentBook.book_id, page_number: currentPage, question_mix, difficulty, language: teachingLanguage, llm_provider: llmProvider })
      });
      if (!res.ok) throw new Error("Homework generation failed");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setActiveHomework(data); setWorkspaceMode("homework");
        setShowHomeworkSetup(false);
        const msg = "I have prepared homework based on this page. Solve it on paper, then upload or capture a photo and I will check it for you.";
        setMessages(prev => [...prev, { role: 'bot', content: msg }]);
        setTextToSpeak(msg);
      } else {
        alert("The model couldn't generate homework for this page's content.");
      }
    } catch (err) {
      alert("Error generating homework: " + err.message);
    } finally {
      setIsGeneratingHomework(false);
      hideLoader();
    }
  };

  // Generate concise revision "pocket notes" for the current page and drop them
  // into the chat as a pinned note card (also included in the PDF export).
  const handlePocketNotes = async () => {
    if (!currentBook || isGeneratingNotes) return;
    setIsGeneratingNotes(true);
    showLoader("Generating Pocket Notes…", "Summarizing key concepts for this page", "🗂️");
    setMessages(prev => [...prev, { role: 'user', content: `Make pocket notes for page ${currentPage}.` }]);
    try {
      const res = await fetch(apiUrl(ENDPOINTS.pocketNotes), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: currentBook.book_id, page_number: currentPage, language: teachingLanguage, llm_provider: llmProvider })
      });
      if (!res.ok) throw new Error("Could not create notes");
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', type: 'notes', content: data.notes, page: currentPage }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: `Sorry, I couldn't make notes for this page. ${err.message}` }]);
    } finally {
      setIsGeneratingNotes(false);
      hideLoader();
    }
  };

  // Find 2-3 related YouTube videos for the chapter (searched by chapter/book name),
  // shown as a card in the chat. Cached per book on the backend.
  const handleFetchVideos = async () => {
    if (!currentBook || isLoadingVideos) return;
    setIsLoadingVideos(true);
    showLoader("Finding Related Videos…", "Searching for top learning videos for this chapter", "📺");
    setMessages(prev => [...prev, { role: 'user', content: 'Show me reference videos for this chapter.' }]);
    try {
      // Build a rich search query (e.g. "Electricity And Circuits Class 6 Science") for relevant results
      const parts = [
        currentBook.title || selectedBookName,
        selectedClass,
        selectedSubject
      ].filter(Boolean);
      const enrichedQuery = parts.join(' ');

      const res = await fetch(apiUrl(ENDPOINTS.chapterVideos), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: currentBook.book_id, query: enrichedQuery })
      });
      if (!res.ok) throw new Error("Video search failed");
      const data = await res.json();
      if (Array.isArray(data.videos) && data.videos.length > 0) {
        setMessages(prev => [...prev, { role: 'bot', type: 'videos', videos: data.videos }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: "I couldn't find good reference videos for this chapter right now. Please try again in a moment." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: `Sorry, video search failed. ${err.message}` }]);
    } finally {
      setIsLoadingVideos(false);
      hideLoader();
    }
  };

  const handleSendChat = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setIsPaused(false); setIsExplaining(true); setTextToSpeak("");
    try {
      // Answer from the current page + relevant content across the whole chapter, cited by page.
      const res = await fetch(apiUrl(ENDPOINTS.askChapter), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: currentBook.book_id, question: userText, page_number: currentPage, language: teachingLanguage, llm_provider: llmProvider, history: messages })
      });
      if (!res.ok) throw new Error("Q&A request failed");
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.explanation }]);
      setTextToSpeak(data.explanation);
      // Show the book's own diagrams/figures relevant to this answer, if any.
      if (Array.isArray(data.images) && data.images.length > 0) {
        setMessages(prev => [...prev, { role: 'bot', type: 'figures', images: data.images }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: `Error: ${err.message}` }]);
    } finally {
      setIsExplaining(false);
    }
  };

  // Evaluate voice session transcript and display report card in chat feed
  const handleCallFinished = async (callData) => {
    const { turns, seconds, bookId, bookTitle, pageNumber, language } = callData;
    if (!turns || turns.length === 0) return;

    const loadingMsgId = 'report_' + Date.now();
    setMessages(prev => [...prev, {
      id: loadingMsgId,
      role: 'bot',
      type: 'call_report_loading',
      content: 'Analyzing your voice call session & compiling your report card...'
    }]);

    try {
      const res = await fetch(apiUrl(ENDPOINTS.callReport), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId || (currentBook ? currentBook.book_id : ''),
          page_number: pageNumber || currentPage,
          duration_seconds: seconds,
          turns: turns,
          language: language || teachingLanguage,
          llm_provider: llmProvider,
          student_name: currentUser ? currentUser.username : "Student"
        })
      });

      if (!res.ok) throw new Error("Report generation failed");
      const data = await res.json();
      const report = data.report;

      setMessages(prev => prev.map(m => m.id === loadingMsgId ? {
        id: loadingMsgId,
        role: 'bot',
        type: 'call_report',
        report: report,
        callData: {
          bookId: bookId || (currentBook ? currentBook.book_id : ''),
          pageNumber: pageNumber || currentPage,
          durationSeconds: seconds,
          turns: turns,
          studentName: currentUser ? currentUser.username : "Student"
        }
      } : m));

    } catch (err) {
      setMessages(prev => prev.map(m => m.id === loadingMsgId ? {
        id: loadingMsgId,
        role: 'bot',
        content: `Could not generate call report card: ${err.message}`
      } : m));
    }
  };

  const handleDownloadReportPdf = async (callData) => {
    showLoader("Generating PDF Report Card…", "Compiling your voice call performance evaluation", "📊");
    try {
      const res = await fetch(apiUrl(ENDPOINTS.callReportPdf), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: callData.bookId,
          page_number: callData.pageNumber,
          duration_seconds: callData.durationSeconds,
          turns: callData.turns,
          language: teachingLanguage,
          llm_provider: llmProvider,
          student_name: callData.studentName || "Student"
        })
      });

      if (!res.ok) throw new Error("PDF download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Voice_Call_Evaluation_Page${callData.pageNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error downloading PDF report: ${err.message}`);
    } finally {
      hideLoader();
    }
  };

  const handlePrintPdf = useCallback(() => {
    const origTitle = document.title;
    const bookTitleSanitized = (currentBook?.title || selectedBookName || 'Classroom_Lesson')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const dynamicPdfTitle = `${bookTitleSanitized}_Page_${currentPage}_Transcript`;
    document.title = dynamicPdfTitle;
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  }, [currentBook, selectedBookName, currentPage]);

  const handleLogout = () => {
    setAppView("login");
    setCurrentUser(null);
    setCurrentBook(null);
    setMessages([]);
    setTextToSpeak("");
    setIsFullScreenLoading(false);
    if (liveModeRef.current) {
      liveModeRef.current = false;
      setIsLiveMode(false);
      stopRecognition();
    }
    // Clear the attention guard: release the camera, wipe the strike count and
    // reset the warning ladder so the next student starts from a clean slate.
    clearTimeout(cooldownTimerRef.current);
    clearInterval(logoutTimerRef.current);
    stopNudge();
    setIsVisionActive(false);
    setAttentionAlert(null);
    setAttentionCooldown(false);
    setSessionEnded(false);
    setLogoutIn(0);
    setDistractionCount(0);
    distractionCountRef.current = 0;
    setVisionStats({ distractions: 0, awaySeconds: 0 });
    resetNudgeRotation();
  };

  // Ends the lesson after the final strike. Separate from the ⏻ button only so
  // the intent is obvious at the call site.
  const endSessionNow = () => {
    setIsPaused(false);
    handleLogout();
  };

  // ── Login Screen ──
  if (appView === "login") {
    return <LoginScreen onLoginSuccess={(user) => { setCurrentUser(user); setAppView("selection"); }} />;
  }

  // ── Avatar Selection Screen ──
  if (appView === "selection") {
    return (
      <AvatarSelectionScreen
        currentUser={currentUser}
        onLogout={handleLogout}
        currentAvatar={selectedAvatar}
        onSelectAvatar={(avatarId) => setSelectedAvatar(avatarId)}
        onEnterClassroom={handleEnterClassroom}
        selectedAccent={selectedAccent}
        setSelectedAccent={setSelectedAccent}
        catalog={catalog}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        selectedSubject={selectedSubject}
        setSelectedSubject={setSelectedSubject}
        selectedBookName={selectedBookName}
        setSelectedBookName={setSelectedBookName}
      />
    );
  }

  // The avatar is still "preparing" from click until it actually starts speaking
  // (covers the explain/quiz call AND the azure-tts wait) — used to hide the
  // playback bar until the voice is ready. The chat shows a "Thinking…" state.
  const isPreparing =
    isExplaining ||
    isGeneratingQuiz ||
    (!!textToSpeak && currentSpokenWordIndex < 0 && !isPaused && !isLiveMode);

  // ── Attention Guard arming ──
  // The camera measures focus whenever Vision is on, but the guard only ENFORCES
  // while the avatar is genuinely mid-explanation. It stays out of the way during
  // a voice call, Live Interact, quiz/homework work, and any already-paused state.
  const isLessonSpeaking =
    !!textToSpeak && !isPreparing && !isPaused && !teacherOpen && !isLiveMode && workspaceMode === 'pdf';
  const attentionArmed =
    isVisionActive && isLessonSpeaking && !attentionAlert && !attentionCooldown && !sessionEnded;
  attentionArmedRef.current = attentionArmed;

  // The homework panel opens its own camera; two getUserMedia grabs on the same
  // device fail on some Windows webcams, so release the vision stream first.
  const visionCameraActive = isVisionActive && workspaceMode !== 'homework';

  // ── Classroom View ──
  return (
    <div className="app-container theme-day">
      {/* ── Left Pane ── */}
      <BookReader
        onBack={() => setAppView("selection")}
        onLogout={handleLogout}
        locked={false}
        currentBook={currentBook}
        currentPageText={currentPageText}
        totalPages={currentBook ? currentBook.total_pages : 0}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        teachingLanguage={teachingLanguage}
        setTeachingLanguage={setTeachingLanguage}
        llmProvider={llmProvider}
        isVisionActive={isVisionActive}
        setIsVisionActive={setIsVisionActive}
        showVisionPreview={showVisionPreview}
        setShowVisionPreview={setShowVisionPreview}
        selectedStyle={selectedStyle}
        setSelectedStyle={setSelectedStyle}
        onTeachPage={handleTeachPage}
        isExplaining={isExplaining}
        onGenerateQuizClick={handleGenerateQuiz}
        isGeneratingQuiz={isGeneratingQuiz}
        onGenerateHomeworkClick={() => setShowHomeworkSetup(true)}
        isGeneratingHomework={isGeneratingHomework}
        activeHomework={activeHomework}
        setActiveHomework={setActiveHomework}
        onPocketNotes={handlePocketNotes}
        isGeneratingNotes={isGeneratingNotes}
        onFetchVideos={handleFetchVideos}
        isLoadingVideos={isLoadingVideos}
        numQuestions={numQuestions}
        setNumQuestions={setNumQuestions}
        workspaceMode={workspaceMode}
        setWorkspaceMode={setWorkspaceMode}
        activeQuiz={activeQuiz}
        setActiveQuiz={setActiveQuiz}
        onQuizSubmit={(result) => {
          setMessages(prev => [...prev, { role: 'bot', content: `### Quiz Graded!\n* **Score**: ${result.correct_count}/${result.total_questions} (${result.score * 10}%)\n* **Critique**: ${result.feedback_summary}` }]);
          setTextToSpeak(`You scored ${result.correct_count} out of ${result.total_questions}. ${result.feedback_summary}`);
        }}
        chapterLOs={chapterLOs}
        isLoadingLOs={isLoadingLOs}
        showLOBanner={showLOModal}
        setShowLOBanner={setShowLOModal}
        onPlayAvatarBriefing={(speechText) => {
          setShowLOModal(false);
          if (speechText) {
            setTextToSpeak(speechText);
            setMessages(prev => [...prev, { role: 'bot', content: `🎯 **Chapter Orientation Briefing:**\n\n${speechText}` }]);
          }
        }}
        onOpenLOModal={() => {
          if (currentBook) {
            setAllowManualLOModalClose(true);
            if (chapterLOs) {
              // Re-check the cache: the language may have changed since the first
              // briefing, in which case that voice has to be fetched again.
              const gender = selectedAvatar === '/avatarsdk.glb' ? 'male' : 'female';
              const { voiceName } = azureVoiceFor(teachingLanguage, gender, selectedAccent);
              setLoVoiceReady(isTtsReady(chapterLOs.avatar_intro, voiceName));
              setShowLOModal(true);
            } else {
              fetchLearningOutcomes(currentBook.book_id, true);
            }
          }
        }}
      />

      {/* Homework setup card (choose question-type mix + difficulty before generating) */}
      <HomeworkSetupModal
        open={showHomeworkSetup}
        busy={isGeneratingHomework}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        onGenerate={handleGenerateHomework}
        onClose={() => { if (!isGeneratingHomework) setShowHomeworkSetup(false); }}
      />

      {/* ── Right Pane — AI Teacher Hub ── */}
      <div className="right-pane" style={{ position: 'relative' }}>
        {/* Avatar Section */}
        <div className="avatar-section">

          <div className="avatar-status-badge">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-dot ${isExplaining || isGeneratingQuiz ? 'loading' : ''}`} />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>
                {isExplaining ? 'Explaining…' : isGeneratingQuiz ? 'Generating Quiz…' : 'Connected'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setTeacherOpen(true)}
                disabled={!currentBook || isLiveMode}
                title={!currentBook ? "Load a book first" : isLiveMode ? "Stop Live Interact first" : "Talk to the teacher about this page"}
                style={{
                  background: (!currentBook || isLiveMode) ? '#e2e8f0' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: (!currentBook || isLiveMode) ? '#94a3b8' : '#fff',
                  border: 'none', borderRadius: '12px', padding: '5px 12px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: (!currentBook || isLiveMode) ? 'not-allowed' : 'pointer',
                }}
              >
                📞 Call Teacher
              </button>
              <button
                onClick={handlePrintPdf}
                disabled={messages.length === 0}
                title={messages.length === 0 ? "No conversation yet" : "Save this conversation as PDF"}
                style={{
                  background: messages.length === 0 ? '#e2e8f0' : 'rgba(99,102,241,0.12)',
                  color: messages.length === 0 ? '#94a3b8' : '#4f46e5',
                  border: 'none', borderRadius: '12px', padding: '5px 12px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                ⬇ PDF
              </button>
              <button
                className="change-avatar-btn"
                onClick={() => { setTextToSpeak(""); setAppView('selection'); }}
              >
                Change 🔄
              </button>
            </div>
          </div>

          <AvatarCanvas
            ref={avatarRef}
            modelUrl={selectedAvatar}
            /* While the Call-Teacher modal is open, mute the page-explanation voice so the
               teacher (Gemini Live) is the only one talking — no overlapping audio. */
            textToSpeak={teacherOpen ? "" : textToSpeak}
            gender={selectedAvatar === '/avatarsdk.glb' ? 'male' : 'female'}
            accent={selectedAccent}
            language={teachingLanguage}
            isPaused={isPaused}
            onSubtitleWord={(word, index) => setCurrentSpokenWordIndex(index)}
            onSpeechEnd={handleSpeechEnd}
            onSpeechStart={handleSpeechStart}
          />

          {/* ── Attention Guard overlay ──
              Centred on the whole screen (portalled to <body>) so the warning is
              impossible to miss and the lesson cannot continue behind it. The
              avatar is already paused here; Resume continues from the exact word
              it stopped on, because TalkingHead.stop() only SUSPENDS its
              AudioContext rather than discarding the audio. */}
          {attentionAlert && createPortal(
            <div className="attention-overlay">
              <div className="attention-card">
                <div className="attention-eye">👀</div>
                <h3>Lesson Paused</h3>
                <p>
                  {attentionAlert.reason === 'no_face'
                    ? "I couldn't see you for 5 seconds."
                    : attentionAlert.reason === 'tab_hidden'
                      ? 'You switched away from the lesson for 5 seconds.'
                      : 'You looked away for 5 seconds.'}
                  <br />
                  Please focus on the learning — press Resume when you're ready.
                </p>
                <button className="attention-resume-btn" onClick={handleResumeAfterAttention}>
                  ▶ Resume Lesson
                </button>
                <div className="attention-meta">
                  Warning <b>{distractionCount}</b> of {MAX_WARNINGS}
                  {distractionCount >= MAX_WARNINGS
                    ? ' — the next distraction ends your session.'
                    : ` — ${MAX_WARNINGS - distractionCount + 1} more and your session ends.`}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* ── Session ended — every warning was ignored ── */}
          {sessionEnded && createPortal(
            <div className="attention-overlay">
              <div className="attention-card attention-card--ended">
                <div className="attention-eye">⛔</div>
                <h3>Session Ended</h3>
                <p>
                  You lost focus <b>{distractionCount}</b> times despite {MAX_WARNINGS} warnings.
                  <br />
                  The lesson has been stopped and you are being signed out.
                </p>
                <div className="attention-countdown">Logging out in {logoutIn}s</div>
                <button className="attention-resume-btn attention-resume-btn--danger" onClick={endSessionNow}>
                  Log out now
                </button>
                <div className="attention-meta">
                  Sign back in when you're ready to concentrate on the lesson.
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Playback Controls (hidden until the voice actually starts) */}
          {textToSpeak && !isPreparing && (
            <div className="playback-bar">
              <button
                onClick={() => { if (avatarRef.current) { avatarRef.current.seekToTime(0); if (isPaused) setIsPaused(false); } }}
                title="Restart"
              >⏪</button>
              <button
                className={isPaused ? 'play-active' : ''}
                onClick={() => setIsPaused(!isPaused)}
              >{isPaused ? "▶" : "⏸"}</button>
              <input
                type="range" min="0" max={totalTimeMs || 100} value={currentTimeMs}
                onChange={(e) => { const t = Number(e.target.value); setCurrentTimeMs(t); if (avatarRef.current) avatarRef.current.seekToTime(t); }}
              />
            </div>
          )}
        </div>

        {/* Chat Transcript */}
        <div className="chat-transcript-card">
          <div className="chat-messages">
            {(() => {
              const activeBotIndex = textToSpeak
                ? messages.findLastIndex(m => m.role === 'bot' && m.content === textToSpeak && !m.content?.includes("loaded"))
                : -1;

              return messages.map((msg, i) => {
                // ── Rich (interactive) chat messages ──
                if (msg.type === 'actions') {
                  return (
                    <div key={i} className="chat-widget">
                      <ChatFollowUps onPick={generateChatQuestion} disabled={isQGenerating} />
                    </div>
                  );
                }
                if (msg.type === 'notes') {
                  return (
                    <div key={i} className="chat-widget">
                      <div style={S.notesCard}>
                        <div style={S.notesHeader}>🗂️ Pocket Notes{msg.page ? ` · page ${msg.page}` : ''}</div>
                        <div style={S.notesBody} className="pocket-notes-content">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'call_report_loading') {
                  return (
                    <div key={i} className="message-bubble bot">
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="typing-indicator" />{msg.content}
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'call_report' && msg.report) {
                  const r = msg.report;
                  return (
                    <div key={i} className="chat-widget">
                      <div style={{
                        border: '1px solid var(--glass-border, #e2e8f0)', borderRadius: 16,
                        background: 'var(--bg-secondary, #fff)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
                          padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>🏆 Voice Session Performance & Report</div>
                            <div style={{ fontSize: 11, opacity: 0.85 }}>Page {msg.callData?.pageNumber || 1} • {Math.floor((msg.callData?.durationSeconds || 0)/60)}m {(msg.callData?.durationSeconds || 0)%60}s session</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{r.grade || 'F'}</div>
                            <div style={{ fontSize: 10, opacity: 0.9 }}>Mastery: {r.overall_score ?? 0}%</div>
                          </div>
                        </div>

                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Score breakdown bars */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {[
                              ['🗣️ Articulation', r.articulation_score ?? 0, '#3b82f6'],
                              ['🧠 Question Depth', r.question_quality_score ?? 0, '#8b5cf6'],
                              ['⚡ Comprehension', r.comprehension_score ?? 0, '#ec4899'],
                              ['⏱️ Call Focus', r.time_efficiency_score ?? 0, '#10b981'],
                            ].map(([label, val, color], sIdx) => (
                              <div key={sIdx} style={{ background: 'var(--bg-tertiary, #f8fafc)', padding: '8px 10px', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                                  <span>{label}</span>
                                  <span>{val}%</span>
                                </div>
                                <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 3 }} />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Summary & Teacher Notes */}
                          {r.summary_paragraph && (
                            <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text-main)' }}>
                              <b>Summary:</b> {r.summary_paragraph}
                            </div>
                          )}
                          {r.teacher_notes && (
                            <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-muted)', background: 'var(--bg-tertiary, #f8fafc)', padding: '8px 12px', borderRadius: 10, borderLeft: '3px solid #4f46e5' }}>
                              💡 <b>Teacher Advice:</b> {r.teacher_notes}
                            </div>
                          )}

                          {/* Download PDF Button */}
                          <button
                            onClick={() => handleDownloadReportPdf(msg.callData)}
                            style={{
                              background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                              border: 'none', borderRadius: 12, padding: '10px 16px',
                              fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              boxShadow: '0 4px 12px rgba(16,185,129,0.3)', marginTop: 4
                            }}
                          >
                            📥 Download Official PDF Report Card
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'videos') {
                  return (
                    <div key={i} className="chat-widget">
                      <div style={S.videosCard}>
                        <div style={S.videosHeader}>📺 Reference Videos</div>
                        {msg.videos.map((v, vi) => (
                          <div
                            key={vi}
                            onClick={() => setActiveVideoModal(v)}
                            style={{ ...S.videoRow, cursor: 'pointer' }}
                            title="Click to play video inside application"
                          >
                            {v.thumbnail
                              ? <img src={v.thumbnail} alt="" style={S.videoThumb} referrerPolicy="no-referrer" />
                              : <div style={S.videoThumb} />}
                            <div style={{ minWidth: 0 }}>
                              <div style={S.videoTitle}>{v.title}</div>
                              <div style={S.videoMeta}>▶ {v.publisher || 'YouTube'}{v.duration ? ` · ${v.duration}` : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'figures') {
                  return (
                    <div key={i} className="chat-widget">
                      <div style={S.figuresCard}>
                        <div style={S.figuresHeader}>🖼️ Related figures from the book</div>
                        <div style={S.figuresGrid}>
                          {msg.images.map((img, fi) => (
                            <div
                              key={fi}
                              style={S.figureCard}
                              onClick={() => setActiveImageModal(apiUrl(img.path))}
                              title={`Figure on page ${img.page_number} — click to enlarge`}
                            >
                              <img src={apiUrl(img.path)} alt={`Figure on page ${img.page_number}`} style={S.figureImg} loading="lazy" />
                              <div style={S.figureCaption}>Page {img.page_number}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
                if (msg.type === 'question') {
                  if (msg.loading) {
                    return (
                      <div key={`q${msg.id}`} className="message-bubble bot">
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="typing-indicator" />Preparing your question…
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`q${msg.id}`} className="chat-widget">
                      <ChatQuestionCard
                        q={msg.data}
                        language={teachingLanguage}
                        llmProvider={llmProvider}
                        onAskAnother={offerFollowUps}
                      />
                    </div>
                  );
                }

                const isActiveBot = i === activeBotIndex;
                if (isActiveBot) {
                  const tokens = msg.content.split(/(\s+)/);
                  let wordCount = 0;
                  const slicedTokens = [];
                  for (let j = 0; j < tokens.length; j++) {
                    if (currentSpokenWordIndex < 0) break;
                    const token = tokens[j];
                    if (token.trim().length > 0) wordCount++;
                    slicedTokens.push(token);
                    if (wordCount > currentSpokenWordIndex) break;
                  }
                  const slicedContent = slicedTokens.join("");
                  return (
                    <div key={i} className="message-bubble bot active-speaking">
                      {currentSpokenWordIndex < 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="typing-indicator" />Thinking…
                        </div>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{slicedContent || "…"}</ReactMarkdown>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} className={`message-bubble ${msg.role}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                  </div>
                );
              });
            })()}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input / Live Mode */}
          <div className="chat-footer">
            {isLiveMode ? (
              <LiveInteractButton isLiveMode={true} isListening={isListening} isProcessing={isLiveProcessing} liveTranscript={liveTranscript} onToggle={handleLiveModeToggle} />
            ) : (
              <form onSubmit={handleSendChat} className="chat-input-form">
                <LiveInteractButton isLiveMode={false} onToggle={handleLiveModeToggle} disabled={!currentBook || isExplaining} />
                <input
                  type="text"
                  className="chat-input"
                  placeholder={currentBook ? "Ask a question about this page…" : "Loading textbook…"}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={!currentBook || isExplaining}
                />
                <button type="submit" className="send-btn" disabled={!currentBook || !chatInput.trim() || isExplaining}>➔</button>
              </form>
            )}
          </div>
        </div>

        {/* Call-Teacher card — docked over the right (chat) pane so the PDF stays visible */}
        {teacherOpen && currentBook && (
          <TeacherVoiceModal
            book={currentBook}
            page={currentPage}
            gender={selectedAvatar === '/avatarsdk.glb' ? 'male' : 'female'}
            language={teachingLanguage}
            onClose={() => { setTeacherOpen(false); setTextToSpeak(""); }}
            onCallFinished={handleCallFinished}
          />
        )}

        {/* MediaPipe Vision Engine — Focus Monitoring & Gesture Control */}
        <MediaPipeVision
          isActive={visionCameraActive}
          showVideoPreview={showVisionPreview}
          armed={attentionArmed}
          onAttentionLost={handleAttentionLost}
          /* NO auto-resume — looking back must not restart the lesson on its own.
             The student has to acknowledge the nudge with the Resume button. */
          onAttentionRestored={() => {}}
          onGesture={handleGesture}
          onFocusScoreUpdate={setVisionFocusScore}
          onStatsUpdate={(s) => setVisionStats({ distractions: s.distractions, awaySeconds: s.awaySeconds })}
        />
      </div>
      {isFullScreenLoading && createPortal(
        <div className="upload-loader-overlay theme-day">
          <div className="upload-loader-card">
            <div className="upload-loader-ring">
              <span className="upload-loader-emoji">{loadingConfig.emoji || "🎓"}</span>
            </div>
            <div className="upload-loader-text">
              <h3>{loadingConfig.title || "Preparing Explanation…"}</h3>
              <p>{loadingConfig.subtitle || "Please give me a moment"}</p>
            </div>
            <div className="upload-loader-bar"><span /></div>
          </div>
        </div>,
        document.body
      )}

      {/* Printable transcript — hidden on screen, the only thing that prints (Save as PDF). */}
      {createPortal(
        <div className="print-area">
          {/* Header Banner */}
          <div className="print-banner">
            <div className="print-banner-logo">🎓 TEACHER AI — ACADEMIC LESSON RECORD</div>
            <div className="print-banner-title">{currentBook?.title || 'Interactive Lesson'}</div>
          </div>

          {/* Metadata Card Grid */}
          <div className="print-meta-grid">
            <div className="print-meta-item">
              <span className="print-meta-label">TEXTBOOK / CHAPTER</span>
              <span className="print-meta-val">{currentBook?.title || 'General Subject'}</span>
            </div>
            <div className="print-meta-item">
              <span className="print-meta-label">PAGE NUMBER</span>
              <span className="print-meta-val">Page {currentPage}</span>
            </div>
            <div className="print-meta-item">
              <span className="print-meta-label">STUDENT NAME</span>
              <span className="print-meta-val">{currentUser?.username || 'Student'}</span>
            </div>
            <div className="print-meta-item">
              <span className="print-meta-label">RECORD DATE</span>
              <span className="print-meta-val">{new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            {/* Camera-based attention record — only meaningful if Vision was on. */}
            {isVisionActive && (
              <div className="print-meta-item">
                <span className="print-meta-label">ATTENTION / FOCUS</span>
                <span className="print-meta-val">
                  {visionFocusScore}% focused · {distractionCount} distraction{distractionCount === 1 ? '' : 's'}
                  {visionStats.awaySeconds > 0 ? ` · ${visionStats.awaySeconds}s away` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="print-section-title">💬 Conversation Transcript & Study Notes</div>

          {messages.filter(m => m.type !== 'actions').map((m, i) => {
            const who = m.role === 'user' ? (currentUser?.username || 'Student') : 'AI Teacher Avatar';

            if (m.type === 'notes') {
              return (
                <div key={i} className="print-card print-notes-card">
                  <div className="print-card-header notes-hdr">🗂️ Pocket Notes (Page {m.page || currentPage})</div>
                  <div className="print-card-body">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              );
            }

            if (m.type === 'call_report' && m.report) {
              const r = m.report;
              return (
                <div key={i} className="print-card print-report-card">
                  <div className="print-card-header report-hdr">
                    <span>🏆 Voice Session Performance & Report Card</span>
                    <span className="print-grade-badge">Grade: {r.grade || 'N/A'} (Mastery: {r.overall_score ?? 0}%)</span>
                  </div>
                  <div className="print-card-body">
                    <div className="print-report-grid">
                      <div>🗣️ Articulation: <b>{r.articulation_score ?? 0}%</b></div>
                      <div>🧠 Question Depth: <b>{r.question_quality_score ?? 0}%</b></div>
                      <div>⚡ Comprehension: <b>{r.comprehension_score ?? 0}%</b></div>
                      <div>⏱️ Call Focus: <b>{r.time_efficiency_score ?? 0}%</b></div>
                    </div>
                    {r.summary_paragraph && <div style={{ marginTop: '8px' }}><b>Summary:</b> {r.summary_paragraph}</div>}
                    {r.teacher_notes && <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#4f46e5' }}>💡 <b>Teacher Advice:</b> {r.teacher_notes}</div>}
                  </div>
                </div>
              );
            }

            if (m.type === 'question' && m.data) {
              const q = m.data;
              const opts = Array.isArray(q.options) ? q.options.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${o}`).join('\n') : '';
              return (
                <div key={i} className="print-card print-quiz-card">
                  <div className="print-card-header quiz-hdr">📝 Practice Question</div>
                  <div className="print-card-body">
                    <b>{q.question}</b>
                    {opts && <div style={{ marginTop: '6px', whiteSpace: 'pre-line', fontSize: '12px' }}>{opts}</div>}
                    {q.explanation && <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}><i>Explanation: {q.explanation}</i></div>}
                  </div>
                </div>
              );
            }

            if (m.type === 'videos') {
              return (
                <div key={i} className="print-card print-video-card">
                  <div className="print-card-header video-hdr">📺 Reference Videos</div>
                  <div className="print-card-body">
                    {(m.videos || []).map((v, vi) => (
                      <div key={vi}>• <b>{v.title}</b> ({v.publisher || 'YouTube'})</div>
                    ))}
                  </div>
                </div>
              );
            }

            let content = m.content || '';
            if (!content) return null;

            return (
              <div key={i} className={`print-msg ${m.role}`}>
                <div className="print-who">{who}</div>
                <div className="print-bubble-body">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
                </div>
              </div>
            );
          })}

          <div className="print-footer">
            <span>Generated by Teacher AI Platform</span>
            <span>Page {currentPage} Transcript</span>
          </div>
        </div>,
        document.body
      )}

      {/* ── Textbook Figure Lightbox ── */}
      {activeImageModal && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out'
          }}
          onClick={() => setActiveImageModal(null)}
        >
          <img
            src={activeImageModal}
            alt="Textbook figure"
            style={{
              maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain',
              borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* ── Embedded Video Modal ── */}
      {activeVideoModal && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => setActiveVideoModal(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: '840px', background: 'var(--bg-secondary, #1e293b)',
              borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--glass-border, rgba(255,255,255,0.15))',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', display: 'flex', flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <h3
                style={{
                  color: 'var(--text-main, #fff)', fontSize: '15px', fontWeight: 600,
                  margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '720px'
                }}
              >
                📺 {activeVideoModal.title}
              </h3>
              <button
                onClick={() => setActiveVideoModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                  width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                ✕
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
              <iframe
                src={getYouTubeEmbedUrl(activeVideoModal.url)}
                title={activeVideoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Chapter Orientation Pop-Up Modal Card ── */}
      {(showLOModal || isLoadingLOs) && createPortal(
        <LearningOutcomesModal
          loData={chapterLOs}
          isLoading={isLoadingLOs}
          phase={loPhase}
          voiceReady={loVoiceReady}
          allowManualClose={allowManualLOModalClose}
          onClose={() => setShowLOModal(false)}
          onStartLesson={(avatarIntroSpeech) => {
            setShowLOModal(false);
            setAllowManualLOModalClose(true);
            if (avatarIntroSpeech) {
              setCurrentSpokenWordIndex(-1);
              setTextToSpeak(avatarIntroSpeech);
              setMessages(prev => [...prev, {
                role: 'bot',
                content: avatarIntroSpeech
              }]);
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}
