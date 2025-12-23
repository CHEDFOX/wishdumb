import React, { useState, useEffect, useRef, useCallback } from "react";
import { Scene, Thought } from "./types";
import BackgroundEngine from "./components/BackgroundEngine";
import FloatingThought from "./components/FloatingThought";
import { generateThought } from "./services/llmService";
import { speakThought } from "./services/voiceService";
import { MAX_THOUGHTS } from "./constants";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
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

  // ---------------- SPEECH RECOGNITION ----------------

  useEffect(() => {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      setMicError("Microphone not supported");
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setMicError(null);
      setIsListening(true);
    };

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      handleInput(transcript, "voice");
    };

    recognition.onerror = (e: any) => {
      setMicError(e.error || "Mic error");
      setIsListening(false);
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

  // ---------------- THOUGHT HELPERS ----------------

  const center = () => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2 - 40,
  });

  const randomExitVelocity = () => {
    const angle = Math.random() * Math.PI * 2;
    return {
      vx: Math.cos(angle) * 4.5,
      vy: Math.sin(angle) * 4.5,
    };
  };

  const spawnQuestion = (text: string): Thought => {
    const c = center();
    const v = randomExitVelocity();

    return {
      id: crypto.randomUUID(),
      text,
      kind: "question",

      x: c.x,
      y: c.y,

      vx: v.vx,
      vy: v.vy,

      createdAt: Date.now(),
      opacity: 0.6,
      scale: 0.9,
    };
  };

  const spawnResponse = (text: string): Thought => {
    const c = center();

    return {
      id: crypto.randomUUID(),
      text,
      kind: "response",

      x: c.x,
      y: c.y,

      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,

      createdAt: Date.now(),
      opacity: 0.85,
      scale: 1,
    };
  };

  const pushThought = (t: Thought) => {
    thoughtsRef.current = [t, ...thoughtsRef.current].slice(0, MAX_THOUGHTS);
    setThoughts([...thoughtsRef.current]);
  };

  // ---------------- INPUT (THIS WAS BROKEN BEFORE) ----------------

  const handleInput = async (
    text: string,
    mode: "text" | "voice"
  ) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputText("");

    // 1️⃣ QUESTION always appears and exits
    pushThought(spawnQuestion(text));

    try {
      // 2️⃣ QUESTION IS SENT TO OPENROUTER HERE
      const response = await generateThought(text);

      // 3️⃣ RESPONSE always appears
      pushThought(
        spawnResponse(
          response && response.trim().length
            ? response
            : "…"
        )
      );

      if (mode === "voice") {
        await speakThought(response);
      }
    } catch (err) {
      // 4️⃣ FALLBACK RESPONSE (never silent)
      pushThought(
        spawnResponse(
          "Silence sometimes answers more honestly than words."
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------- ANIMATION LOOP ----------------

  const animate = useCallback(() => {
    const now = Date.now();

    thoughtsRef.current = thoughtsRef.current.filter((t) => {
      t.x += t.vx;
      t.y += t.vy;

      if (t.kind === "question") {
        t.opacity -= 0.025;

        const off =
          t.x < -300 ||
          t.x > window.innerWidth + 300 ||
          t.y < -300 ||
          t.y > window.innerHeight + 300;

        return t.opacity > 0 && !off;
      }

      // response behavior
      const age = now - t.createdAt;
      t.opacity = Math.max(0.35, 0.85 - age / 140000);

      const margin = 160;
      if (t.x < margin || t.x > window.innerWidth - margin) t.vx *= -1;
      if (t.y < margin || t.y > window.innerHeight - 260) t.vy *= -1;

      return true;
    });

    setThoughts([...thoughtsRef.current]);
    frameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (scene === Scene.CHAT) {
      frameRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scene, animate]);

  // ---------------- UI ----------------

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden text-white">
      <BackgroundEngine scene={scene} />

      {scene === Scene.LANDING && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => {
              setScene(Scene.TRANSITIONING);
              setTimeout(() => setScene(Scene.CHAT), 2200);
            }}
            className="w-52 h-52 rounded-full bg-emerald-500/20 animate-pulse"
          />
        </div>
      )}

      {scene === Scene.CHAT && (
        <>
          {thoughts.map((t) => (
            <FloatingThought key={t.id} thought={t} />
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInput(inputText, "text");
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
                className="flex-1 bg-transparent text-xs tracking-[0.25em] text-center outline-none"
              />

              <button
                type="button"
                onClick={toggleListening}
                className={`text-sm ${
                  isListening
                    ? "text-emerald-400"
                    : "text-white/40 hover:text-white"
                }`}
              >
                🎤
              </button>

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
