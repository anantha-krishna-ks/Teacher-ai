// ────────────────────────────────────────────────────────────────────────────
// Backend configuration — one place to switch between LOCAL and HOSTED backends.
//
//   ⇩⇩⇩  SWITCH HERE  ⇩⇩⇩   ('local' or 'hosted')
const DEFAULT_BACKEND = 'local';
//   ⇧⇧⇧               ⇧⇧⇧
//
// You can also override without editing this file by setting VITE_BACKEND in a
// .env file (e.g. `VITE_BACKEND=hosted`), or VITE_API_BASE for a custom base URL.
// Everything below (REST + WebSocket) is derived from the chosen apiBase.
// ────────────────────────────────────────────────────────────────────────────

const BACKENDS = {
  local: {
    apiBase: '/api',
  },
  // Hosted (production) backend
  hosted: {
    apiBase: 'https://ailevate-poc.excelsoftcorp.com/aiapps/avatarchatbot',
  },
};

const ACTIVE_BACKEND = import.meta.env.VITE_BACKEND || DEFAULT_BACKEND;
const active = BACKENDS[ACTIVE_BACKEND] || BACKENDS.local;

// Base URL for all backend calls (env var VITE_API_BASE wins if set).
export const API_BASE = import.meta.env.VITE_API_BASE || active.apiBase;

// All backend endpoints in one place (paths are relative to API_BASE).
// Local resolves e.g. to /api/catalog; hosted to
// https://ailevate-poc.excelsoftcorp.com/aiapps/avatarchatbot/catalog
export const ENDPOINTS = {
  catalog:   '/catalog',
  loadBook:  '/load-book',
  uploadPdf: '/upload-pdf',
  books:     '/books',            // + /{id}/pages/{n}  and  /{id}/pdf/pages/{n}
  explain:     '/chat/explain',          // explain the current page ("Teach Me Page")
  askChapter:  '/chat/ask-chapter',       // Q&A: current page + relevant chapter pages
  pocketNotes: '/chat/pocket-notes',      // concise revision notes for the current page
  chapterVideos: '/chapter/videos',       // 2-3 YouTube reference videos for the chapter
  learningOutcomes: '/chapter/learning-outcomes', // chapter objectives & learning outcomes
  callReport:    '/chat/call-report',     // evaluate voice call transcript across 5 metrics
  callReportPdf: '/chat/call-report/pdf', // generate downloadable PDF report card
  quiz:      '/chat/quiz',
  grade:     '/chat/grade',
  homework:         '/chat/homework',           // generate written homework from the current page
  homeworkEvaluate: '/chat/homework/evaluate',  // grade an uploaded photo of the answers (multipart)
  question:  '/chat/question',   // single in-chat practice question (mcq/true_false/fill_blank/short_answer)
  validate:  '/chat/validate',   // LLM validation of a typed answer
  azureTts:  '/avatar/azure-tts',
  live:      '/avatar/live',      // WebSocket (Gemini Live "Call Teacher")
  health:    '/health',
};

// Build a full REST URL, e.g. apiUrl(ENDPOINTS.catalog) or apiUrl(`/books/${id}/pages/${n}`).
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : '/' + path;
  return `${API_BASE}${p}`;
}

// Build the WebSocket URL, e.g. wsUrl(ENDPOINTS.live).
// Absolute https base -> wss://; http -> ws://. Relative base -> current page host (dev proxy).
export function wsUrl(path) {
  const p = path.startsWith('/') ? path : '/' + path;
  if (/^https?:\/\//i.test(API_BASE)) {
    return API_BASE.replace(/^http/i, 'ws') + p; // https->wss, http->ws
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${API_BASE}${p}`;
}

// Handy for debugging which backend is active.
export const BACKEND_INFO = { name: ACTIVE_BACKEND, apiBase: API_BASE };
