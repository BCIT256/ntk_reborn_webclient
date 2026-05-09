import { useInteraction } from "@/hooks/useInteractionStore";

/**
 * NpcDialog — Classic MMO NPC dialog window.
 *
 * Deep navy/black semi-transparent background, sharp borders,
 * gold header text, white body text. Monospace-ish feel.
 *
 * Props come from the interaction store (no external props needed).
 */
const NpcDialog = () => {
  const { active, respondDialog } = useInteraction();

  if (!active || active.kind !== "dialog") return null;

  const { npcId, name, message } = active;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    respondDialog(npcId, 1);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog window */}
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
              {name}
            </span>
          </div>

          {/* ── Message body ────────────────────────────────────────── */}
          <div className="px-5 py-4">
            <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>

          {/* ── Action button ───────────────────────────────────────── */}
          <div className="flex justify-end px-4 pb-3">
            <button
              onClick={handleClose}
              className="px-6 py-1.5 text-sm font-bold tracking-wider uppercase
                         border-2 border-slate-400 bg-slate-800 text-amber-400
                         hover:bg-slate-700 hover:border-amber-500/60
                         active:bg-slate-900
                         transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpcDialog;
