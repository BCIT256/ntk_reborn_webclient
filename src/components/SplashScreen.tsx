import { useEffect, useRef, useState, useCallback } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * SplashScreen — Plays an MP4 splash video on first launch, then
 * smoothly fades out to the title screen when the video ends.
 *
 * ── Where to put your video ──────────────────────────────────────
 *   public/assets/splash/SPLASH.mp4
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

    setFadeOut(true);
    setTimeout(onComplete, 1200);
  }, [onComplete]);

  useEffect(() => {
    if (videoError) {
      const timer = setTimeout(triggerComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [videoError, triggerComplete]);

  // ── Autoplay with sound ──────────────────────────────────────────
  // Browsers block autoplay of unmuted video. Strategy:
  //   1. Try to play WITH audio first (works if the browser's media
  //      engagement score allows it, or the user previously interacted)
  //   2. If blocked, fall back to muted playback so at least the video
  //      is visible, then try to unmute on the first user interaction.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoError) return;

    // Attempt 1: play with audio
    video.muted = false;
    const playPromise = video.play();

    if (playPromise) {
      playPromise.catch(() => {
        // Browser blocked unmuted autoplay — retry muted
        video.muted = true;
        video.play().catch(() => {
          // Even muted autoplay failed — mark as error
          setVideoError(true);
        });
      });
    }
  }, [videoError]);

  // ── Unmute on first user interaction ─────────────────────────────
  // If we fell back to muted, any click/keypress lets us unmute.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.muted) return;

    const unmute = () => {
      if (videoRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
      window.removeEventListener("click", unmute);
      window.removeEventListener("keydown", unmute);
    };

    window.addEventListener("click", unmute);
    window.addEventListener("keydown", unmute);

    return () => {
      window.removeEventListener("click", unmute);
      window.removeEventListener("keydown", unmute);
    };
  }, []);

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
          src="/assets/splash/SPLASH.mp4"
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
