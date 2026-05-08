import { useEffect, useRef, useState, useCallback } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * SplashScreen — Plays an MP4 splash video on first launch, then
 * smoothly fades out to the title screen when the video ends.
 *
 * ── Where to put your video ──────────────────────────────────────
 *   public/assets/splash/splash.mp4
 *   Format: MP4 (H.264), ~8 seconds, 1920×1080+
 *
 * If the video file is missing, a dark fallback is shown for 3 seconds.
 * ─────────────────────────────────────────────────────────────────
 */
const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const hasTriggered = useRef(false);

  const triggerComplete = useCallback(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    // Start fade-out, then call onComplete after the transition
    setFadeOut(true);
    setTimeout(onComplete, 1200);
  }, [onComplete]);

  useEffect(() => {
    // Fallback timer: if video is missing or errors, show dark screen for 3s
    if (videoError) {
      const timer = setTimeout(triggerComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [videoError, triggerComplete]);

  const handleVideoEnded = () => {
    triggerComplete();
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  return (
    <div
      className={`absolute inset-0 bg-black flex items-center justify-center transition-opacity duration-1000 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* ── Video Player ──────────────────────────────────────────── */}
      {!videoError && (
        <video
          ref={videoRef}
          src="/assets/splash/splash.mp4"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── Fallback (no video) ────────────────────────────────────── */}
      {videoError && (
        <div className="flex flex-col items-center justify-center gap-4">
          <h1
            className="text-4xl font-bold text-white tracking-tighter"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            Yuroxia
          </h1>
          <div className="w-12 h-12 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default SplashScreen;
