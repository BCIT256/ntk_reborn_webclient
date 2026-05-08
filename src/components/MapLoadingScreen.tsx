"use client";

import React, { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress";
import { assetManager } from '@/utils/assetManager';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MapLoadingScreenProps {
  onComplete: () => void;
}

const MapLoadingScreen: React.FC<MapLoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing Patcher...");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const startPatching = async () => {
      try {
        await assetManager.init();
        setStatus("Checking for updates...");
        await assetManager.syncManifest();
        
        setStatus("Downloading Map Assets...");
        await assetManager.downloadMissingMaps((current, total) => {
          setStats({ current, total });
          setProgress(Math.floor((current / total) * 100));
        });

        setStatus("Patching Complete!");
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