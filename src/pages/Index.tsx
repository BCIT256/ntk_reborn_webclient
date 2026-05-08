import { useEffect, useRef, useState, useCallback } from "react";
import { GameApp } from "../gameMain";
import { socket } from "../socket";
import MapLoadingScreen from "../components/MapLoadingScreen";
import SplashScreen from "../components/SplashScreen";
import TitleScreen from "../components/TitleScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { md5 } from "../utils/md5";
import { Wifi, WifiOff } from "lucide-react";

type GameState = "splash" | "title" | "unauthenticated" | "patching" | "playing";

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameApp | null>(null);
  const loginAudioRef = useRef<HTMLAudioElement | null>(null);
  const [gameState, setGameState] = useState<GameState>("splash");

  // Store the spawn data while we patch
  const [spawnPayload, setSpawnPayload] = useState<any>(null);

  // Form State
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  // Connection state
  const [isOnline, setIsOnline] = useState(socket.connected);

  // ── Periodic Reconnect Check ────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setTimeout> | null = null;

    if (gameState === "unauthenticated" && !isOnline) {
      // Start periodic check only when on the login screen and offline
      interval = setInterval(() => {
        console.log("Attempting periodic reconnect...");
        // Calling connect() will attempt to establish a new connection.
        // If successful, handleConnect will be called, setting isOnline to true.
        socket.connect();
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [gameState, isOnline]);

  // ── Login Screen Timeout ────────────────────────────────
  useEffect(() => {
    if (gameState === "unauthenticated") {
      const timeout = setTimeout(() => {
        console.log("Login screen timeout: returning to title screen.");
        setGameState("title");
      }, 120000); // 2 minutes

      return () => clearTimeout(timeout);
    }
  }, [gameState]);

  // ── Login screen music ──────────────────────────────────────────────
  const fadeOutLoginMusic = useCallback(() => {
    const audio = loginAudioRef.current;
    if (!audio) return;
    const fadeInterval = setInterval(() => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - 0.04);
      } else {
        audio.pause();
        audio.currentTime = 0;
        clearInterval(fadeInterval);
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (gameState === "unauthenticated") {
      // Start login music
      const audio = loginAudioRef.current;
      if (audio) {
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
    } else {
      // Fade out login music when leaving the login screen
      fadeOutLoginMusic();
    }
  }, [gameState, fadeOutLoginMusic]);

  useEffect(() => {
    const handleMessage = (packet: any) => {
      if (packet.type === "MapChange") {
        console.log("Login successful! Intercepted MapChange:", packet.payload);
        setSpawnPayload(packet.payload);
        setGameState("patching");
      }
    };

    const handleConnect = () => setIsOnline(true);
    const handleDisconnect = () => setIsOnline(false);

    const handleConnectionLost = () => {
      console.log("Connection lost — returning to login screen.");
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
      setSpawnPayload(null);
      setPassword("");
      setIsOnline(false);
      setGameState("unauthenticated");
    };

    socket.onMessage(handleMessage);
    socket.onConnect(handleConnect);
    socket.onDisconnect(handleDisconnect);
    socket.onConnectionLost(handleConnectionLost);

    // Connect to server in background during title screen
    socket.connect();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (gameState === "playing" && containerRef.current && !gameRef.current && spawnPayload) {
      gameRef.current = new GameApp(containerRef.current, spawnPayload);
    }
  }, [gameState, spawnPayload]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !isOnline) return;

    setIsConnecting(true);
    const hashedPassword = md5(password);

    setPassword("");

    socket.send({
      type: "LoginRequest",
      payload: {
        username: username,
        password_hash: hashedPassword,
      },
    });

    setTimeout(() => setIsConnecting(false), 2000);
  };

  const canSubmit = isOnline && !isConnecting;

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      {/* ── Splash Screen ────────────────────────────────────────── */}
      {gameState === "splash" && (
        <SplashScreen onComplete={() => setGameState("title")} />
      )}

      {/* ── Title Screen ─────────────────────────────────────────── */}
      {gameState === "title" && (
        <TitleScreen onComplete={() => setGameState("unauthenticated")} isOnline={isOnline} />
      )}

      {/* ── Login Screen ─────────────────────────────────────────── */}
      {gameState === "unauthenticated" && (
        <div className="flex flex-col items-center justify-center h-full bg-slate-950">
          {/* ── Login Background Music ──────────────────────────── */}
          <audio
            ref={loginAudioRef}
            src="/assets/login/Yuroxia_login_screen.mp3"
            loop
            preload="auto"
          />
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6 max-w-sm w-full mx-4">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white tracking-tighter">Yuroxia</h1>
              <p className="text-slate-400 text-sm">Enter your credentials to connect.</p>
            </div>

            {/* Connection status indicator */}
            <div
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg border transition-colors ${
                isOnline
                  ? "bg-emerald-950/40 border-emerald-800/50"
                  : "bg-red-950/40 border-red-800/50"
              }`}
            >
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${
                  isOnline ? "text-emerald-300" : "text-red-300"
                }`}
              >
                Server connection: {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white"
                  placeholder="••••••••"
                  autoComplete="off"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className={`w-full font-semibold py-6 rounded-xl transition-all mt-4 ${
                  canSubmit
                    ? "bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
              >
                {!isOnline
                  ? "Waiting for server..."
                  : isConnecting
                    ? "Connecting..."
                    : "Enter World"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── Map Loading ───────────────────────────────────────────── */}
      {gameState === "patching" && spawnPayload && (
        <MapLoadingScreen
          targetMapId={spawnPayload.map_id}
          onComplete={() => setGameState("playing")}
        />
      )}

      {/* ── Game Canvas ───────────────────────────────────────────── */}
      {gameState === "playing" && (
        <div ref={containerRef} className="w-full h-full" />
      )}
    </div>
  );
};

export default Index;