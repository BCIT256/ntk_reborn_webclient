"use client";

import React, { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { assetManager } from "@/utils/assetManager";
import { eventBus } from "@/utils/eventBus";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ─── Props for the initial patching mode ─────────────────────────────

interface MapLoadingScreenProps {
  onComplete: () => void;
  targetMapId?: any;
}

// ─── Component ───────────────────────────────────────────────────────

const MapLoadingScreen: React.FC<MapLoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing Patcher...");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ current: 0, total: 0 });

  useEffect(() => {
    let highestProgress = 0;

    const startPatching = async () => {
      try {
        await assetManager.init();
        setStatus("Loading sprite atlases...");
        await assetManager.loadSpritesheets();
        setStatus("Checking for updates...");
        await assetManager.syncManifest();

        setStatus("Downloading Map Assets...");
        await assetManager.downloadMissingMaps((current, total) => {
          setStats({ current, total });
          const calculated = Math.floor((current / total) * 100);
          highestProgress = Math.max(highestProgress, calculated);
          setProgress(highestProgress);
        });

        setStatus("Patching Complete!");
        setProgress(100);
        setTimeout(onComplete, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred during patching");
      }
    };

    startPatching();
  }, [onComplete]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <Alert variant="destructive" className="max-w-md bg-red-950 border-red-900 text-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Patching Failed</AlertTitle>
          <AlertDescription>
            {error}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full bg-red-900 hover:bg-red-800 text-white py-2 rounded-md transition-colors"
            >
              Retry Update
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-200 space-y-8 p-6">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
        <div className="relative flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-2xl font-bold tracking-tight">Updating Game Assets</h2>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-between text-sm font-medium text-slate-400 mb-1">
          <span>{status}</span>
          {stats.total > 0 && (
            <span>{stats.current} / {stats.total}</span>
          )}
        </div>

        <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-900">
          <Progress value={progress} className="h-full w-full flex-1 bg-blue-600 transition-all duration-300" />
        </div>

        <p className="text-center text-xs text-slate-500 italic">
          Please do not close your browser while the update is in progress.
        </p>
      </div>
    </div>
  );
};

export default MapLoadingScreen;

// ─── Map Transition Overlay ──────────────────────────────────────────

/**
 * MapTransitionOverlay — Renders a full-screen loading overlay
 * driven by MapTransitionStart / MapTransitionComplete EventBus events.
 *
 * Shows a retro-styled black overlay with "Loading..." text while a map
 * transition is in progress. Fades out when MapTransitionComplete fires.
 *
 * Must be mounted inside the game view (during "playing" state).
 */
export const MapTransitionOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const unsubStart = eventBus.on("MapTransitionStart", () => {
      setFadingOut(false);
      setVisible(true);
    });

    const unsubComplete = eventBus.on("MapTransitionComplete", () => {
      setFadingOut(true);
      // Wait for fade-out animation, then unmount
      setTimeout(() => {
        setVisible(false);
        setFadingOut(false);
      }, 400);
    });

    return () => {
      unsubStart();
      unsubComplete();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center bg-black
                  transition-opacity duration-400
                  ${fadingOut ? "opacity-0" : "opacity-100"}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-4 select-none">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-amber-400 font-mono text-sm tracking-widest uppercase">
          Loading...
        </p>
      </div>
    </div>
  );
};
