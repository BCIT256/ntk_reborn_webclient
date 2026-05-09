import { useState, useEffect, useCallback } from "react";
import { eventBus } from "../utils/eventBus";

/**
 * SystemMenu — Classic NexusTK-style system menu triggered by F1.
 *
 * Retro dialog with two sections:
 *   Settings: Volume sliders for Master, BGM, SFX
 *   Actions:  "Quit to Title" button
 *
 * Visibility is toggled via the EventBus "ToggleSystemMenu" event.
 * "Quit to Title" emits "QuitToTitle" on the EventBus for Index.tsx to handle.
 */
const SystemMenu = () => {
  const [visible, setVisible] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [bgmVol, setBgmVol] = useState(60);
  const [sfxVol, setSfxVol] = useState(70);

  // Listen for F1 toggle via EventBus
  useEffect(() => {
    const unsub = eventBus.on("ToggleSystemMenu", () => {
      setVisible((prev) => !prev);
    });
    return unsub;
  }, []);

  const handleQuitToTitle = useCallback(() => {
    setVisible(false);
    eventBus.emit("QuitToTitle");
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        setVisible(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ pointerEvents: "auto" }}
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setVisible(false)}
      />

      {/* Retro dialog box */}
      <div className="relative z-10 w-80 bg-slate-900/95 border-2 border-slate-500 font-mono text-sm select-none">
        {/* Title bar */}
        <div className="bg-slate-700 border-b-2 border-slate-500 px-3 py-1 text-yellow-300 font-bold text-center">
          System Menu
        </div>

        {/* ── Settings Section ────────────────────────────────────── */}
        <div className="p-3 space-y-3">
          <div className="text-yellow-300 font-bold border-b border-slate-600 pb-1">
            Settings
          </div>

          {/* Master Volume */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300 w-24">Master Vol</span>
            <input
              type="range"
              min={0}
              max={100}
              value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="flex-1 accent-yellow-400 h-2"
            />
            <span className="text-white w-8 text-right">{masterVol}</span>
          </div>

          {/* BGM Volume */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300 w-24">BGM</span>
            <input
              type="range"
              min={0}
              max={100}
              value={bgmVol}
              onChange={(e) => setBgmVol(Number(e.target.value))}
              className="flex-1 accent-yellow-400 h-2"
            />
            <span className="text-white w-8 text-right">{bgmVol}</span>
          </div>

          {/* SFX Volume */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300 w-24">SFX</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sfxVol}
              onChange={(e) => setSfxVol(Number(e.target.value))}
              className="flex-1 accent-yellow-400 h-2"
            />
            <span className="text-white w-8 text-right">{sfxVol}</span>
          </div>
        </div>

        {/* ── Actions Section ─────────────────────────────────────── */}
        <div className="p-3 pt-0 space-y-3">
          <div className="text-yellow-300 font-bold border-b border-slate-600 pb-1">
            Actions
          </div>

          <button
            onClick={handleQuitToTitle}
            className="w-full py-2 bg-red-900 border-2 border-red-600 text-red-200 font-bold
                       hover:bg-red-800 hover:text-white active:bg-red-950 transition-colors"
          >
            Quit to Title
          </button>
        </div>

        {/* Footer hint */}
        <div className="text-center text-slate-500 text-xs py-1 border-t border-slate-600">
          Press F1 or ESC to close
        </div>
      </div>
    </div>
  );
};

export default SystemMenu;
