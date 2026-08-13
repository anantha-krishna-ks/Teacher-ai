// ────────────────────────────────────────────────────────────────────────────
// Languages the Teacher AI supports — SINGLE SOURCE OF TRUTH.
//
// Add ONE entry here and the language automatically works in every path:
//   • Gemini Live "Ask the Teacher" voice call  → steered by `value` (the name)
//   • REST chat / "Teach Me Page" text           → steered by `value`
//   • 3D avatar "Teach Me Page" Azure TTS         → female / male voice + ttsCode
//   • Live Interact mic (Web Speech recognition)  → sttCode
//
// Azure Neural voice short-names verified against Microsoft's Speech "language
// support" list. The Gemini Live model is multilingual, so the voice call needs
// only the language NAME (`value`) — no per-language voice config.
// ────────────────────────────────────────────────────────────────────────────

export const LANGUAGES = [
  // English is special: the US/IN accent toggle picks the voice.
  {
    value: 'English', label: 'English', sttCode: 'en-US',
    accents: {
      US: { ttsCode: 'en-US', female: 'en-US-AriaNeural',   male: 'en-US-GuyNeural'     },
      IN: { ttsCode: 'en-IN', female: 'en-IN-NeerjaNeural', male: 'en-IN-PrabhatNeural' },
    },
  },
  { value: 'Hindi',     label: 'Hindi (हिंदी)',       sttCode: 'hi-IN', ttsCode: 'hi-IN', female: 'hi-IN-SwaraNeural',     male: 'hi-IN-MadhurNeural'   },
  { value: 'Kannada',   label: 'Kannada (ಕನ್ನಡ)',      sttCode: 'kn-IN', ttsCode: 'kn-IN', female: 'kn-IN-SapnaNeural',     male: 'kn-IN-GaganNeural'    },
  { value: 'Tamil',     label: 'Tamil (தமிழ்)',        sttCode: 'ta-IN', ttsCode: 'ta-IN', female: 'ta-IN-PallaviNeural',   male: 'ta-IN-ValluvarNeural' },
  { value: 'Telugu',    label: 'Telugu (తెలుగు)',      sttCode: 'te-IN', ttsCode: 'te-IN', female: 'te-IN-ShrutiNeural',    male: 'te-IN-MohanNeural'    },
  { value: 'Malayalam', label: 'Malayalam (മലയാളം)',  sttCode: 'ml-IN', ttsCode: 'ml-IN', female: 'ml-IN-SobhanaNeural',   male: 'ml-IN-MidhunNeural'   },
  { value: 'Marathi',   label: 'Marathi (मराठी)',      sttCode: 'mr-IN', ttsCode: 'mr-IN', female: 'mr-IN-AarohiNeural',    male: 'mr-IN-ManoharNeural'  },
  { value: 'Bengali',   label: 'Bengali (বাংলা)',      sttCode: 'bn-IN', ttsCode: 'bn-IN', female: 'bn-IN-TanishaaNeural',  male: 'bn-IN-BashkarNeural'  },
  { value: 'Gujarati',  label: 'Gujarati (ગુજરાતી)',  sttCode: 'gu-IN', ttsCode: 'gu-IN', female: 'gu-IN-DhwaniNeural',    male: 'gu-IN-NiranjanNeural' },
  { value: 'Punjabi',   label: 'Punjabi (ਪੰਜਾਬੀ)',    sttCode: 'pa-IN', ttsCode: 'pa-IN', female: 'pa-IN-VaaniNeural',     male: 'pa-IN-OjasNeural'     },
  { value: 'Urdu',      label: 'Urdu (اردو)',          sttCode: 'ur-IN', ttsCode: 'ur-IN', female: 'ur-IN-GulNeural',       male: 'ur-IN-SalmanNeural'   },
  { value: 'Odia',      label: 'Odia (ଓଡ଼ିଆ)',         sttCode: 'or-IN', ttsCode: 'or-IN', female: 'or-IN-SubhasiniNeural', male: 'or-IN-SukantNeural'   },
  { value: 'Assamese',  label: 'Assamese (অসমীয়া)',   sttCode: 'as-IN', ttsCode: 'as-IN', female: 'as-IN-YashicaNeural',   male: 'as-IN-PriyomNeural'   },
];

// Options for the <Dropdown /> in the reader header.
export const LANGUAGE_OPTIONS = LANGUAGES.map(({ value, label }) => ({ value, label }));

const BY_VALUE = Object.fromEntries(LANGUAGES.map((l) => [l.value, l]));

// BCP-47 code for the browser SpeechRecognition mic (Live Interact).
export function sttCodeFor(language) {
  return BY_VALUE[language]?.sttCode || 'en-US';
}

// Azure Neural voice + locale for the 3D avatar "Teach Me Page" TTS.
// `accent` ('US' | 'IN') only affects English; other languages ignore it.
export function azureVoiceFor(language, gender = 'female', accent = 'US') {
  const g = (gender || 'female').toLowerCase() === 'male' ? 'male' : 'female';
  const lang = BY_VALUE[language];
  // English (or an unknown value) → accent-based US/IN voice.
  if (!lang || lang.accents) {
    const acc = (lang && lang.accents) || BY_VALUE.English.accents;
    const pick = accent === 'IN' ? acc.IN : acc.US;
    return { voiceName: pick[g], ttsLangCode: pick.ttsCode };
  }
  return { voiceName: lang[g], ttsLangCode: lang.ttsCode };
}
