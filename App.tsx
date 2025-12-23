import React, { useState, useEffect, useRef, useCallback } from "react";
import { Scene, Thought } from "./types";
import BackgroundEngine from "./components/BackgroundEngine";
import FloatingThought from "./components/FloatingThought";
import { generateThought } from "./services/llmService";
import { speakThought } from "./services/voiceService";
import { MAX_THOUGHTS } from "./constants";

const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>(Scene.LANDING);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const thoughtsRef = useRef<Thought[]>([]);
  const frameRef = useRef<number>();

  // ---------- THOUGHT CREATION ----------

  const addThought = (text: string, method: "voice" | "text") => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2 - 40;

    const thought: Thought = {
      id: crypto.randomUUID(),
      text,

      // arrive at center
      x: centerX,
      y: centerY,

      // very slow drift
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,

      createdAt: Date.now(),
      anchorTime: Date.now(),
      phase: "drifting", // drift immediately after arrival

      opacity: 0,
      scale: 1.0,

      method,
    };

    thoughtsRef.current = [thought, ...thoughtsRef.current].slice(0, MAX_THOUGHTS);
    setThoughts([...thoughtsRef.current]);
  };

  // ---------- DRIFT ENGINE ----------

  const animateThoughts = useCallback(() => {
    const now = Date.now();

    thoughtsRef.current.forEach((t) => {
      // slow continuous drift
      t.x += t.vx;
      t.y += t.vy;

      // soft boundaries
      const marginX = 160;
      const marginY = 140;

      if (t.x < marginX || t.x > window.innerWidth - marginX) t.vx *= -1;
      if (t.y < marginY || t.y > window.innerHeight - 240) t.vy *= -1;

      // fade logic
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

  // ---------- INPUT ----------

  const processInput = async (text: string, method: "voice" | "text") => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputText("");

    try {
      const response = await generateThought(text);
      addThought(response, method);
      if (method === "voice") await speakThought(response);
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

          {/* INPUT */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              processInput(inputText, "text");
            }}
            className="
              absolute bottom-10 left-1/2 -translate-x-1/2
              w-full max-w-3xl px-8
            "
          >
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isProcessing ? "" : "enter a thought"}
              className="
                w-full
                bg-black/20
                border border-white/10
                rounded-md
                px-6
                py-3
                text-sm
                tracking-[0.25em]
                text-center
                outline-none
                focus:border-white/30
              "
            />
          </form>
        </>
      )}
    </div>
  );
};

export default App;
