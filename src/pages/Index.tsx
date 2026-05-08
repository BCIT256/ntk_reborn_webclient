import { useEffect, useRef, useState } from "react";
import { GameApp } from "../gameMain";
import { socket } from "../socket";
import MapLoadingScreen from "../components/MapLoadingScreen";
import { Button } from "@/components/ui/button";

type GameState = "unauthenticated" | "patching" | "playing";

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameApp | null>(null);
  const [gameState, setGameState] = useState<GameState>("unauthenticated");

  useEffect(() => {
    // Listen for successful login to start the patcher
    const handleMessage = (packet: any) => {
      if (packet.type === "LoginSuccess") {
        setGameState("patching");
      }
    };

    socket.onMessage(handleMessage);
    socket.connect();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Initialize game only when in 'playing' state
    if (gameState === "playing" && containerRef.current && !gameRef.current) {
      gameRef.current = new GameApp(containerRef.current);
    }
  }, [gameState]);

  const handleLogin = () => {
    // In a real app, this would be a form, but here we just trigger the login
    // which the socket.ts is already configured to send on connection for testing.
    // However, since socket.connect() was called in useEffect, we might already be waiting.
    console.log("Waiting for LoginSuccess event...");
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      {gameState === "unauthenticated" && (
        <div className="flex flex-col items-center justify-center h-full bg-slate-950">
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-6 max-w-sm w-full mx-4">
            <h1 className="text-3xl font-bold text-white tracking-tighter">RPG Adventure</h1>
            <p className="text-slate-400 text-sm">Welcome back, traveler. Ready to continue your journey?</p>
            <Button 
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Enter World
            </Button>
          </div>
        </div>
      )}

      {gameState === "patching" && (
        <MapLoadingScreen onComplete={() => setGameState("playing")} />
      )}

      {gameState === "playing" && (
        <div ref={containerRef} className="w-full h-full" />
      )}
    </div>
  );
};

export default Index;