import { useEffect, useRef, useState, useCallback } from "react";

interface TitleScreenProps {
  onComplete: () => void;
}

/**
 * TitleScreen — Cinematic title screen with background art,
 * looping music, and a "Press any Key to Enter" prompt.
 *
 * ── Asset locations ────────────────────────────────────────────────
 *   Background image:  public/assets/title/title_bg.png
 *   Background music:  public/assets/title/Yuroxia_Title_Screen.mp3
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

      {/* ── Subtle vignette at edges ────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-[18vh] select-none">
        {/* Press any key prompt */}
        <div>
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
        src="/assets/title/Yuroxia_Title_Screen.mp3"
        loop
        preload="auto"
      />
    </div>
  );
};

export default TitleScreen;
