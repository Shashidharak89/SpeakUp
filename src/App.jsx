import { useState, useRef, useEffect, useCallback } from "react";

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
  // "word" = word-by-word | "flow" = full sentence flow
  const [mode, setMode] = useState("word");

  const utteranceRef = useRef(null);
  const wordIndexRef = useRef(0);
  const intervalRef = useRef(null);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        setSelectedVoice(available[0]);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
    wordIndexRef.current = 0;
  }, []);

  const speakWordByWord = useCallback(
    (startIndex = 0) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const wordList = trimmed.split(/\s+/);
      setWords(wordList);

      window.speechSynthesis.cancel();
      clearInterval(intervalRef.current);

      let idx = startIndex;
      wordIndexRef.current = idx;

      const speakNext = () => {
        if (idx >= wordList.length) {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentWordIndex(-1);
          return;
        }

        setCurrentWordIndex(idx);
        wordIndexRef.current = idx;

        const utterance = new SpeechSynthesisUtterance(wordList[idx]);
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        if (selectedVoice) utterance.voice = selectedVoice;

        utterance.onend = () => {
          idx += 1;
          speakNext();
        };

        utterance.onerror = () => {
          idx += 1;
          speakNext();
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      setIsPlaying(true);
      setIsPaused(false);
      speakNext();
    },
    [text, rate, pitch, volume, selectedVoice]
  );

  // ── Flow mode: speak entire text as one natural utterance ──────────
  const speakInFlow = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const wordList = trimmed.split(/\s+/);
    setWords(wordList);

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    if (selectedVoice) utterance.voice = selectedVoice;

    // Track word boundaries if browser supports it
    utterance.onboundary = (e) => {
      if (e.name === "word") {
        // charIndex maps to word index
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

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utteranceRef.current = utterance;
    setIsPlaying(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utterance);
  }, [text, rate, pitch, volume, selectedVoice]);

  const handlePlay = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else if (mode === "flow") {
      speakInFlow();
    } else {
      speakWordByWord(0);
    }
  };

  const handlePause = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
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
        <p className="tagline">Word-by-word · Sentence flow pronunciation tool</p>
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

        {/* Word Display */}
        {words.length > 0 && (
          <section className="word-display card">
            <label className="section-label">Word Tracker</label>
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
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

        {/* Current Word Spotlight */}
        {currentWordIndex >= 0 && words[currentWordIndex] && (
          <section className="spotlight card">
            <label className="section-label">Currently Speaking</label>
            <div className="spotlight-word">{words[currentWordIndex]}</div>
          </section>
        )}

        {/* Controls */}
        <section className="controls-card card">
          <label className="section-label">Playback Controls</label>

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
            {/* Speed */}
            <div className="slider-group">
              <div className="slider-label-row">
                <span>🐢 Speed</span>
                <span className="slider-val">{rate.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="slider slider-speed"
              />
              <div className="slider-ticks">
                <span>0.5×</span>
                <span>1×</span>
                <span>2×</span>
              </div>
            </div>

            {/* Pitch */}
            <div className="slider-group">
              <div className="slider-label-row">
                <span>🎵 Pitch</span>
                <span className="slider-val">{pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="slider slider-pitch"
              />
              <div className="slider-ticks">
                <span>Low</span>
                <span>Normal</span>
                <span>High</span>
              </div>
            </div>

            {/* Volume */}
            <div className="slider-group">
              <div className="slider-label-row">
                <span>🔈 Volume</span>
                <span className="slider-val">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="slider slider-volume"
              />
              <div className="slider-ticks">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Voice Selector */}
          {voices.length > 0 && (
            <div className="voice-select-wrap">
              <label className="slider-label-row">
                <span>🎙 Voice</span>
              </label>
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
        <p>SpeakUp — Powered by Web Speech API</p>
      </footer>
    </div>
  );
}

export default App;
