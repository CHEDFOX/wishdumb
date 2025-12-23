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
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const thoughtsRef = useRef<Thought[]>([]);
  const frameRef = useRef<number>();
  const recognitionRef = useRef<any>(null);

  // ---------- SPEECH ----------

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;

    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      handleInput(text, "voice");
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
    setIsListening(!isListening);
  };

  // ---------- THOUGHT CREATION ----------

  const spawnThought = (text: string, opacity = 0.8): Thought => ({
    id: crypto.randomUUID(),
    text,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2 - 40,
    vx: (Math.random() - 0.5) * 0.06,
    vy: (Math.random() - 0.5) * 0.06,
    createdAt: Date.now(),
    anchorTime: Date.now(),
    phase: "drifting",
    opacity,
    scale: 1,
    method: "text",
  });

  const addThought = (thought: Thought) => {
    thoughtsRef.current = [thought, ...thoughtsRef.current].slice(
      0,
      MAX_THOUGHTS
    );
    setThoughts([...thoughtsRef.current]);
  };

  // ---------- INPUT HANDLING ----------

  const handleInput = async (text: string, mode: "text" | "voice") => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputText("");

    // 1️⃣ USER THOUGHT (always appears)
    addThought(spawnThought(text, 0.35));

    try {
      const response = await generateThought(text);

      // 2️⃣ RESPONSE (always appears)
      addThought(
        spawnThought(
          response && response.trim().length > 0
            ? response
            : "…",
          0.85
        )
      );

      if (mode === "voice") await speakThought(response);
    } catch {
      // 3️⃣ FALLBACK RESPONSE (presence never disappears)
      addThought(
        spawnThought(
          "Silence is sometimes the most honest answer.",
          0.7
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- DRIFT ----------

  const animate = useCallback(() => {
    const now = Date.now();

    thoughtsRef.current.forEach((t) => {
      t.x += t.vx;
      t.y += t.vy;

      const mx = 140;
      const my = 120;

      if (t.x < mx || t.x > window.innerWidth - mx) t.vx *= -1;
      if (t.y < my || t.y > window.innerHeight - 220) t.vy *= -1;

      const age = now - t.createdAt;
      t.opacity = Math.max(0.3, 0.85 - age / 150000);
    });

    setThoughts([...thoughtsRef.current]);
    frameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (scene === Scene.CHAT) frameRef.current = requestAnimationFrame(animate);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
  }, [scene, animate]);

  // ---------- UI ----------

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <BackgroundEngine scene={scene} />

      {scene === Scene.LANDING && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            className="w-52 h-52 rounded-full bg-emerald-500/20 animate-pulse"
            onClick={() => {
              setScene(Scene.TRANSITIONING);
              setTimeout(() => setScene(Scene.CHAT), 2000);
            }}
          />
        </div>
      )}

      {scene === Scene.CHAT && (
        <>
          {thoughts.map((t) => (
            <FloatingThought key={t.id} thought={t} isLatest={false} />
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInput(inputText, "text");
            }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8"
          >
            <div className="flex items-center gap-4 border border-white/10 bg-black/20 px-4 py-2 rounded-md">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="enter a thought"
                className="flex-1 bg-transparent text-sm tracking-[0.25em] text-center outline-none"
              />

              <button
                type="button"
                onClick={toggleListening}
                className={`text-sm ${
                  isListening ? "text-emerald-400" : "text-white/40"
                }`}
              >
                🎤
              </button>

              <button type="submit" className="text-white/40">
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
