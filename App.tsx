
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Thought } from './types';
import BackgroundEngine from './components/BackgroundEngine';
import FloatingThought from './components/FloatingThought';
import { generateThought } from './services/llmService';
import { speakThought } from './services/voiceService';
import { MAX_THOUGHTS } from './constants';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>(Scene.LANDING);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  
  const thoughtsRef = useRef<Thought[]>([]);
  const requestRef = useRef<number>();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const initSpeech = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMicError('Speech recognition not supported');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setMicError(null);
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        processInput(transcript, 'voice');
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setMicError('Microphone access blocked.');
        } else {
          setMicError(`Error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    };

    initSpeech();
  }, []);

  const toggleListening = async () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setMicError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsListening(false);
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    }
  };

  const handleEnter = () => {
    setScene(Scene.TRANSITIONING);
    setTimeout(() => {
      setScene(Scene.CHAT);
    }, 2500); 
  };

  const updateThoughts = useCallback(() => {
    const now = Date.now();
    const updated = thoughtsRef.current.map((t, index) => {
      let nx = t.x + t.vx;
      let ny = t.y + t.vy;

      const padding = 180;
      if (nx < padding || nx > window.innerWidth - padding) t.vx *= -1;
      if (ny < padding || ny > window.innerHeight - 300) t.vy *= -1;

      const age = now - t.createdAt;
      const baseFade = index === 0 ? 1 : Math.max(0.45, 0.9 - (age / 120000) - (index * 0.1));

      return { ...t, x: nx, y: ny, opacity: baseFade };
    });

    thoughtsRef.current = updated;
    setThoughts([...updated]);
    requestRef.current = requestAnimationFrame(updateThoughts);
  }, []);

  useEffect(() => {
    if (scene === Scene.CHAT) {
      requestRef.current = requestAnimationFrame(updateThoughts);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [scene, updateThoughts]);

  const addThought = (text: string, method: 'voice' | 'text') => {
    const newThought: Thought = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 - 80,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      opacity: 0,
      scale: 1.0,
      createdAt: Date.now(),
      method
    };

    setThoughts(prev => {
      const next = [newThought, ...prev].slice(0, MAX_THOUGHTS);
      thoughtsRef.current = next;
      return next;
    });
  };

  const processInput = async (text: string, mode: 'voice' | 'text') => {
    if (!text.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setInputText('');
    
    try {
      const response = await generateThought(text);
      addThought(response, mode);
      
      if (mode === 'voice') {
        await speakThought(response);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processInput(inputText, 'text');
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans selection:bg-emerald-500/30">
      <BackgroundEngine scene={scene} />

      {scene === Scene.LANDING && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6">
          <button
            onClick={handleEnter}
            className="group relative w-44 h-44 md:w-56 md:h-56 rounded-full flex items-center justify-center transition-all duration-1000"
          >
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping [animation-duration:4s]"></div>
            <div className="absolute inset-0 bg-emerald-500/5 rounded-full scale-125 animate-pulse [animation-duration:6s]"></div>
            <div className="absolute inset-0 border border-emerald-500/20 rounded-full group-hover:border-emerald-500/60 transition-colors duration-700"></div>
            <div className="absolute inset-4 border border-white/5 rounded-full group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="w-24 h-24 bg-emerald-500/40 rounded-full blur-3xl group-hover:bg-emerald-400/60 transition-colors duration-1000"></div>
          </button>
        </div>
      )}

      {scene === Scene.TRANSITIONING && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px] z-30 pointer-events-none transition-opacity duration-1000"></div>
      )}

      {scene === Scene.CHAT && (
        <div className="absolute inset-0 z-10 flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            {thoughts.map((thought, index) => (
              <FloatingThought 
                key={thought.id} 
                thought={thought} 
                isLatest={index === 0} 
              />
            ))}
          </div>

          <div className="max-w-xl mx-auto w-full px-6 pb-12">
            {micError && (
              <div className="text-center mb-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-300/60 font-medium">
                  {micError}
                </p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="relative group">
              <div className="relative flex items-center gap-4 bg-black/10 backdrop-blur-md border-b border-white/10 px-6 transition-all duration-1000 focus-within:border-white/40">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isProcessing ? "" : isListening ? "Listening..." : "Speak to the void"}
                  disabled={isProcessing}
                  className="flex-1 bg-transparent py-5 outline-none text-white placeholder:text-white/5 tracking-[0.15em] text-lg font-extralight"
                />
                
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 transition-all duration-700 rounded-full ${
                    isListening 
                      ? 'text-emerald-300 bg-emerald-400/5 scale-110' 
                      : 'text-white/30 hover:text-white'
                  }`}
                  title="Speech Input"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0ZM208,128a8,8,0,0,1-16,0,64,64,0,0,0-128,0,8,8,0,0,1-16,0,80.11,80.11,0,0,1,72,79.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,208,128Z"></path>
                  </svg>
                </button>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isProcessing}
                  className={`p-3 transition-all duration-700 rounded-full ${
                    isProcessing 
                      ? 'opacity-0' 
                      : 'text-white/30 hover:text-white disabled:opacity-5'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M232,128a8,8,0,0,1-8,8H43.31l42.35,42.34a8,8,0,0,1-11.32,11.32l-56-56a8,8,0,0,1,0-11.32l56-56a8,8,0,0,1,11.32,11.32L43.31,120H224A8,8,0,0,1,232,128Z" transform="rotate(180 128 128)"></path>
                  </svg>
                </button>
              </div>
            </form>
            
            <div className="mt-8 flex justify-center h-2">
              {isProcessing && (
                <div className="flex gap-4 opacity-40">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-duration:1.2s] [animation-delay:-0.4s]"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-duration:1.2s] [animation-delay:-0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-duration:1.2s]"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
