import { useEffect, useRef, useState } from "react";
import { GameApp } from "../gameMain";
import { socket } from "../socket";
import MapLoadingScreen from "../components/MapLoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { md5 } from "../utils/md5";

type GameState = "unauthenticated" | "patching" | "playing";

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameApp | null>(null);
  const [gameState, setGameState] = useState<GameState>("unauthenticated");
  
  // Form State
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Listen for MapChange to trigger patching
    const handleMessage = (packet: any) => {
      if (packet.type === "MapChange") {
        console.log("Login successful! Intercepted MapChange:", packet.payload);
        setGameState("patching");
      }
    };

    socket.onMessage(handleMessage);
    
    // Don't auto-connect - wait for user to submit form
    // socket.connect();

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsConnecting(true);

    const hashedPassword = md5(password);

    // Connect to WebSocket first
    socket.connect();

    // Send the correctly formatted Adjacently Tagged JSON
    socket.send({
      type: "LoginRequest",
      payload: {
        username: username,
        password_hash: hashedPassword,
      },
    });

    // Reset connecting state after a brief timeout if no response is received
    setTimeout(() => setIsConnecting(false), 2000);
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      {gameState === "unauthenticated" && (
        <div className="flex flex-col items-center justify-center h-full bg-slate-950">
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6 max-w-sm w-full mx-4">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white tracking-tighter">Yuroxia</h1>
              <p className="text-slate-400 text-sm">Enter your credentials to connect.</p>
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
                  required
                />
              </div>

              <Button 
                type="submit"
                disabled={isConnecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
              >
                {isConnecting ? "Connecting..." : "Enter World"}
              </Button>
            </form>
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