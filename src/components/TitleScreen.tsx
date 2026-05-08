import { useEffect, useRef, useState, useCallback } from "react";

interface TitleScreenProps {
  onComplete: () => void;
}

/**
 * TitleScreen — Cinematic title screen with background art, game logo,
 * looping music, and a "Press any Key to Enter" prompt.
 *
 * ── Asset locations ────────────────────────────────────────────────
 *   Background image:  public/assets/title/title_bg.png
 *   Background music:  public/assets/title/title_music.mp3 (.wav also works)
 *
 * Replace the placeholder files with your own assets.
 * If the music file is missing, the screen works silently.
 * ───────────────────────────────────────────────────────────────────
 */
const TitleScreen = ({ onComplete }: TitleScreenProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const hasTriggered = useRef(false);

  // Fade in on mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Start music when component becomes visible
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.6;
    const playAttempt = audio.play();
    if (playAttempt) {
      playAttempt.catch(() => {
        // Autoplay blocked — will play on first user interaction
      });
    }
  }, [fadeIn]);

  const triggerComplete = useCallback(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    // Fade out music
    const audio = audioRef.current;
    if (audio) {
      const fadeInterval = setInterval(() => {
        if (audio.volume > 0.05) {
          audio.volume = Math.max(0, audio.volume - 0.04);
        } else {
          audio.pause();
          clearInterval(fadeInterval);
        }
      }, 50);
    }

    // Fade out screen, then call onComplete
    setFadeOut(true);
    setTimeout(onComplete, 1500);
  }, [onComplete]);

  // Listen for any keypress or click to proceed
  useEffect(() => {
    const handleInput = () => {
      triggerComplete();
    };

    window.addEventListener("keydown", handleInput);
    window.addEventListener("click", handleInput);

    return () => {
      window.removeEventListener("keydown", handleInput);
      window.removeEventListener("click", handleInput);
    };
  }, [triggerComplete]);

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${
        fadeIn && !fadeOut ? "opacity-100" : fadeOut ? "opacity-0" : "opacity-0"
      }`}
    >
      {/* ── Background Image ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/assets/title/title_bg.png')" }}
      />

      {/* ── Dark overlay for readability ──────────────────────────── */}
      <div className="absolute inset-0 bg-black/40" />

      {/* ── Subtle vignette ──────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-8 select-none">
        {/* Game Logo */}
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-6xl md:text-8xl font-bold text-white tracking-tighter drop-shadow-2xl"
            style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
              textShadow:
                "0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(99,102,241,0.15), 0 4px 20px rgba(0,0,0,0.8)",
            }}
          >
            Yuroxia
          </h1>
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
        </div>

        {/* Press any key prompt */}
        <div className="mt-16">
          <p
            className="title-pulse text-lg md:text-xl text-white/70 tracking-widest font-light"
            style={{
              textShadow: "0 0 20px rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            Press any Key to Enter the World
          </p>
        </div>
      </div>

      {/* ── Background Music ─────────────────────────────────────── */}
      <audio
        ref={audioRef}
        src="/assets/title/title_music.mp3"
        loop
        preload="auto"
      />
    </div>
  );
};

export default TitleScreen;
