import { useState, useRef, useEffect, useCallback } from "react";

// ResponsiveVoice Indian English voice name
const RV_VOICE = "Indian English Female";

// Detect if ResponsiveVoice is loaded
const hasRV = () =>
  typeof window !== "undefined" && window.responsiveVoice;

function App() {
  const [text, setText] = useState("");
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  // "word" = word-by-word | "flow" = sentence flow
  const [mode, setMode] = useState("word");
  // "browser" = Web Speech API | "indian" = ResponsiveVoice Indian English
  const [engine, setEngine] = useState("browser");
  const [rvReady, setRvReady] = useState(false);

  const utteranceRef = useRef(null);
  const wordIndexRef = useRef(0);
  const intervalRef = useRef(null);
  const rvWordTimerRef = useRef(null);

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        // Auto-select en-IN voice if available
        const inVoice =
          available.find((v) => v.lang === "en-IN") || available[0];
        setSelectedVoice(inVoice);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Poll until ResponsiveVoice is ready
  useEffect(() => {
    if (hasRV()) { setRvReady(true); return; }
    const timer = setInterval(() => {
      if (hasRV()) { setRvReady(true); clearInterval(timer); }
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // ── Stop everything ────────────────────────────────────────────────
  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    clearInterval(intervalRef.current);
    clearTimeout(rvWordTimerRef.current);
    if (hasRV()) window.responsiveVoice.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
    wordIndexRef.current = 0;
  }, []);

  // ── Browser: Word-by-Word ──────────────────────────────────────────
  const browserWordByWord = useCallback(
    (wordList, startIndex = 0) => {
      window.speechSynthesis.cancel();
      let idx = startIndex;

      const speakNext = () => {
        if (idx >= wordList.length) {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentWordIndex(-1);
          return;
        }
        setCurrentWordIndex(idx);
        wordIndexRef.current = idx;

        const utt = new SpeechSynthesisUtterance(wordList[idx]);
        utt.rate = rate;
        utt.pitch = pitch;
        utt.volume = volume;
        if (selectedVoice) utt.voice = selectedVoice;
        utt.onend = () => { idx += 1; speakNext(); };
        utt.onerror = () => { idx += 1; speakNext(); };
        utteranceRef.current = utt;
        window.speechSynthesis.speak(utt);
      };
      speakNext();
    },
    [rate, pitch, volume, selectedVoice]
  );

  // ── Browser: Flow ──────────────────────────────────────────────────
  const browserFlow = useCallback(
    (wordList, fullText) => {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(fullText);
      utt.rate = rate;
      utt.pitch = pitch;
      utt.volume = volume;
      if (selectedVoice) utt.voice = selectedVoice;

      utt.onboundary = (e) => {
        if (e.name === "word") {
          let charCount = 0;
          for (let i = 0; i < wordList.length; i++) {
            if (charCount >= e.charIndex) {
              setCurrentWordIndex(i);
              wordIndexRef.current = i;
              break;
            }
            charCount += wordList[i].length + 1;
          }
        }
      };
      utt.onend = () => {
        setIsPlaying(false); setIsPaused(false); setCurrentWordIndex(-1);
      };
      utt.onerror = () => {
        setIsPlaying(false); setIsPaused(false); setCurrentWordIndex(-1);
      };
      utteranceRef.current = utt;
      window.speechSynthesis.speak(utt);
    },
    [rate, pitch, volume, selectedVoice]
  );

  // ── ResponsiveVoice: Word-by-Word ──────────────────────────────────
  const rvWordByWord = useCallback(
    (wordList, startIndex = 0) => {
      if (!hasRV()) return;
      window.responsiveVoice.cancel();
      let idx = startIndex;

      const speakNext = () => {
        if (idx >= wordList.length) {
          setIsPlaying(false); setIsPaused(false); setCurrentWordIndex(-1);
          return;
        }
        setCurrentWordIndex(idx);
        wordIndexRef.current = idx;

        window.responsiveVoice.speak(wordList[idx], RV_VOICE, {
          rate: rate,
          pitch: pitch,
          volume: volume,
          onend: () => { idx += 1; speakNext(); },
          onerror: () => { idx += 1; speakNext(); },
        });
      };
      speakNext();
    },
    [rate, pitch, volume]
  );

  // ── ResponsiveVoice: Flow (full sentence) ──────────────────────────
  const rvFlow = useCallback(
    (wordList, fullText) => {
      if (!hasRV()) return;
      window.responsiveVoice.cancel();

      // Estimate word timing for highlighting
      const avgWordDurationMs = (60 / (rate * 150)) * 1000;
      let idx = 0;

      const tick = () => {
        if (idx >= wordList.length) return;
        setCurrentWordIndex(idx);
        wordIndexRef.current = idx;
        idx++;
        rvWordTimerRef.current = setTimeout(tick, avgWordDurationMs);
      };

      window.responsiveVoice.speak(fullText, RV_VOICE, {
        rate: rate,
        pitch: pitch,
        volume: volume,
        onstart: () => { tick(); },
        onend: () => {
          clearTimeout(rvWordTimerRef.current);
          setIsPlaying(false); setIsPaused(false); setCurrentWordIndex(-1);
        },
        onerror: () => {
          clearTimeout(rvWordTimerRef.current);
          setIsPlaying(false); setIsPaused(false); setCurrentWordIndex(-1);
        },
      });
    },
    [rate, pitch, volume]
  );

  // ── Master play handler ────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (isPaused && engine === "browser") {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    const wordList = trimmed.split(/\s+/);
    setWords(wordList);
    setIsPlaying(true);
    setIsPaused(false);

    if (engine === "indian") {
      if (!rvReady) { alert("Indian English voice is still loading, please wait a moment."); setIsPlaying(false); return; }
      mode === "word" ? rvWordByWord(wordList, 0) : rvFlow(wordList, trimmed);
    } else {
      mode === "word" ? browserWordByWord(wordList, 0) : browserFlow(wordList, trimmed);
    }
  }, [isPaused, engine, text, mode, rvReady, rvWordByWord, rvFlow, browserWordByWord, browserFlow]);

  const handlePause = () => {
    if (engine === "browser" && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (engine === "indian") {
      // RV doesn't support pause natively — stop and mark paused
      clearTimeout(rvWordTimerRef.current);
      window.responsiveVoice.cancel();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    stopSpeech();
    setText("");
    setWords([]);
  };

  const handleReset = () => {
    stopSpeech();
    setWords(text.trim().split(/\s+/).filter(Boolean));
  };

  const progress =
    words.length > 0 ? ((currentWordIndex + 1) / words.length) * 100 : 0;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🔊</span>
          <span className="logo-text">SpeakUp</span>
        </div>
        <p className="tagline">Word-by-word · Sentence flow · Indian English</p>
      </header>

      <main className="main">
        {/* Text Input */}
        <section className="input-section card">
          <label className="section-label">Enter or Paste Your Text</label>
          <textarea
            className="text-input"
            placeholder="Type or paste your text here…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              stopSpeech();
              setWords([]);
            }}
            rows={6}
          />
          <div className="word-count">
            {text.trim() ? text.trim().split(/\s+/).length : 0} words
          </div>
        </section>

        {/* Word Tracker */}
        {words.length > 0 && (
          <section className="word-display card">
            <label className="section-label">Word Tracker</label>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-text">
              {currentWordIndex >= 0
                ? `${currentWordIndex + 1} / ${words.length}`
                : `0 / ${words.length}`}
            </p>
            <div className="words-grid">
              {words.map((word, i) => (
                <span
                  key={i}
                  className={`word-chip ${
                    i === currentWordIndex
                      ? "word-active"
                      : i < currentWordIndex
                      ? "word-done"
                      : ""
                  }`}
                >
                  {word}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Spotlight */}
        {currentWordIndex >= 0 && words[currentWordIndex] && (
          <section className="spotlight card">
            <label className="section-label">Currently Speaking</label>
            <div className="spotlight-word">{words[currentWordIndex]}</div>
          </section>
        )}

        {/* Controls */}
        <section className="controls-card card">
          <label className="section-label">Playback Controls</label>

          {/* Engine Toggle */}
          <div className="engine-toggle-wrap">
            <span className="toggle-label">🌐 Voice Engine</span>
            <div className="engine-toggle">
              <button
                className={`engine-btn ${engine === "browser" ? "engine-active" : ""}`}
                onClick={() => { stopSpeech(); setWords([]); setEngine("browser"); }}
              >
                🖥 Browser
              </button>
              <button
                className={`engine-btn ${engine === "indian" ? "engine-active engine-indian" : ""}`}
                onClick={() => { stopSpeech(); setWords([]); setEngine("indian"); }}
              >
                🇮🇳 Indian English
                {engine === "indian" && !rvReady && (
                  <span className="loading-dot"> ...</span>
                )}
              </button>
            </div>
            {engine === "indian" && (
              <p className="engine-note">
                {rvReady
                  ? "✅ Indian English Female voice (ResponsiveVoice) is ready"
                  : "⏳ Loading Indian English voice…"}
              </p>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === "word" ? "mode-active" : ""}`}
              onClick={() => { stopSpeech(); setWords([]); setMode("word"); }}
            >
              🔤 Word by Word
            </button>
            <button
              className={`mode-btn ${mode === "flow" ? "mode-active" : ""}`}
              onClick={() => { stopSpeech(); setWords([]); setMode("flow"); }}
            >
              🌊 Sentence Flow
            </button>
          </div>

          {/* Play / Pause / Stop / Reset */}
          <div className="btn-row">
            <button
              className="btn btn-play"
              onClick={handlePlay}
              disabled={!text.trim() || isPlaying}
              title="Play"
            >
              ▶ Play
            </button>
            <button
              className="btn btn-pause"
              onClick={handlePause}
              disabled={!isPlaying}
              title="Pause"
            >
              ⏸ Pause
            </button>
            <button
              className="btn btn-stop"
              onClick={handleStop}
              title="Stop & Clear"
            >
              ⏹ Stop
            </button>
            <button
              className="btn btn-reset"
              onClick={handleReset}
              disabled={isPlaying || isPaused}
              title="Reset"
            >
              ↺ Reset
            </button>
          </div>

          {/* Sliders */}
          <div className="sliders">
            <div className="slider-group">
              <div className="slider-label-row">
                <span>🐢 Speed</span>
                <span className="slider-val">{rate.toFixed(1)}×</span>
              </div>
              <input
                type="range" min="0.5" max="2" step="0.1" value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="slider slider-speed"
              />
              <div className="slider-ticks"><span>0.5×</span><span>1×</span><span>2×</span></div>
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <span>🎵 Pitch</span>
                <span className="slider-val">{pitch.toFixed(1)}</span>
              </div>
              <input
                type="range" min="0.5" max="2" step="0.1" value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="slider slider-pitch"
              />
              <div className="slider-ticks"><span>Low</span><span>Normal</span><span>High</span></div>
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <span>🔈 Volume</span>
                <span className="slider-val">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="slider slider-volume"
              />
              <div className="slider-ticks"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
          </div>

          {/* Browser Voice Selector (only in browser engine) */}
          {engine === "browser" && voices.length > 0 && (
            <div className="voice-select-wrap">
              <label className="slider-label-row"><span>🎙 Browser Voice</span></label>
              <select
                className="voice-select"
                value={selectedVoice ? selectedVoice.name : ""}
                onChange={(e) => {
                  const v = voices.find((v) => v.name === e.target.value);
                  setSelectedVoice(v || null);
                }}
              >
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>SpeakUp — Browser Speech API · ResponsiveVoice Indian English</p>
      </footer>
    </div>
  );
}

export default App;
