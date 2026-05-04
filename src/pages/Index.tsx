import { useEffect, useRef } from "react";
import { GameApp } from "../gameMain";

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameApp | null>(null);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = new GameApp(containerRef.current);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      <div ref={containerRef} className="w-full h-full" />
      {/* The DOMOverlay will be appended to document.body by gameMain.ts */}
    </div>
  );
};

export default Index;