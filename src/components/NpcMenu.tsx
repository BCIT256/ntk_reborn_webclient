import { useState } from "react";
import { useInteraction } from "@/hooks/useInteractionStore";

/**
 * NpcMenu — Classic MMO NPC menu window.
 *
 * Displays a title and a vertical list of clickable options.
 * Hovering an option highlights it (hover:bg-slate-700).
 * Clicking sends MenuResponse back to the server.
 */
const NpcMenu = () => {
  const { active, respondMenu } = useInteraction();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!active || active.kind !== "menu") return null;

  const { menuId, title, options } = active;

  const handleSelect = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    respondMenu(menuId, index);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Menu window */}
      <div
        className="relative z-10 w-full max-w-md mx-4 font-mono select-none"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {/* Outer border — sharp, retro */}
        <div className="border-2 border-slate-400 bg-slate-900/95 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          {/* ── Header bar ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-2 border-b-2 border-slate-400 bg-slate-800/90">
            <span className="text-amber-400 font-bold text-sm tracking-wide uppercase">
              {title}
            </span>
          </div>

          {/* ── Options list ────────────────────────────────────────── */}
          <div className="px-3 py-3 flex flex-col gap-1">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={(e) => handleSelect(e, index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`w-full text-left px-4 py-2 text-sm
                           border-2 transition-colors cursor-pointer
                           ${
                             hoveredIndex === index
                               ? "border-amber-500/60 bg-slate-700 text-amber-300"
                               : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-amber-500/40 hover:text-amber-300"
                           }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpcMenu;
