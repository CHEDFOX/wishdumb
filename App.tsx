import React, { useState, useEffect, useRef, useCallback } from "react";
import { Scene, Thought } from "./types";
import BackgroundEngine from "./components/BackgroundEngine";
import FloatingThought from "./components/FloatingThought";
import { generateThought } from "./services/llmService";
import { speakThought } from "./services/voiceService";
import { MAX_THOUGHTS } from "./constants";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>(Scene.LANDING);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const thoughtsRef = useRef<Thought[]>([]);
  const frameRef = useRef<number>();
  const recognitionRef = useRef<any>(null);

  // ---------- SPEECH RECOGNITION ----------

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError("Microphone not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setMicError(null);
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processInput(transcript, "voice");
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setMicError(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  // ---------- THOUGHT CREATION ----------

  const addThought = (text: string, method: "voice" | "text") => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2 - 40;

    const thought: Thought = {
      id: crypto.randomUUID(),
      text,

      x: centerX,
      y: centerY,

      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,

      createdAt: Date.now(),
      anchorTime: Date.now(),
      phase: "drifting",

      opacity: 1,
      scale: 1,

      method,
    };

    thoughtsRef.current = [thought, ...thoughtsRef.current].slice(
      0,
      MAX_THOUGHTS
    );
    setThoughts([...thoughtsRef.current]);
  };

  // ---------- DRIFT ENGINE ----------

  const animateThoughts = useCallback(() => {
    const now = Date.now();

    thoughtsRef.current.forEach((t) => {
      t.x += t.vx;
      t.y += t.vy;

      const marginX = 160;
      const marginY = 140;

      if (t.x < marginX || t.x > window.innerWidth - marginX) t.vx *= -1;
      if (t.y < marginY || t.y > window.innerHeight - 240) t.vy *= -1;

      const age = now - t.createdAt;
      t.opacity = Math.max(0.35, 0.85 - age / 140000);
    });

    setThoughts([...thoughtsRef.current]);
    frameRef.current = requestAnimationFrame(animateThoughts);
  }, []);

  useEffect(() => {
    if (scene === Scene.CHAT) {
      frameRef.current = requestAnimationFrame(animateThoughts);
    }
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scene, animateThoughts]);

  // ---------- INPUT HANDLER ----------

  const processInput = async (text: string, method: "voice" | "text") => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputText("");

    try {
      const response = await generateThought(text);
      addThought(response, method);
      if (method === "voice") await speakThought(response);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- UI ----------

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      <BackgroundEngine scene={scene} />

      {scene === Scene.LANDING && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <button
            onClick={() => {
              setScene(Scene.TRANSITIONING);
              setTimeout(() => setScene(Scene.CHAT), 2400);
            }}
            className="w-52 h-52 rounded-full bg-emerald-500/20 animate-pulse"
          />
        </div>
      )}

      {scene === Scene.CHAT && (
        <>
          {thoughts.map((t) => (
            <FloatingThought key={t.id} thought={t} isLatest={false} />
          ))}

          {/* INPUT BAR */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              processInput(inputText, "text");
            }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8"
          >
            {micError && (
              <p className="text-xs text-center text-red-400 mb-2">
                {micError}
              </p>
            )}

            <div className="flex items-center gap-4 bg-black/20 border border-white/10 rounded-md px-4 py-2">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isListening
                    ? "listening…"
                    : isProcessing
                    ? ""
                    : "enter a thought"
                }
                className="flex-1 bg-transparent text-sm tracking-[0.25em] text-center outline-none"
              />

              {/* MIC BUTTON */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-full transition ${
                  isListening
                    ? "text-emerald-400"
                    : "text-white/40 hover:text-white"
                }`}
              >
                🎤
              </button>

              {/* SEND */}
              <button
                type="submit"
                disabled={isProcessing || !inputText.trim()}
                className="text-white/40 hover:text-white disabled:opacity-20"
              >
                ➤
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default App;
