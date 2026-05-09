import SideTabs from "./SideTabs";
import VitalsPanel from "./VitalsPanel";
import { socket } from "@/socket";

/**
 * GameSidebar — Fixed-width right-hand panel in the classic NexusTK style.
 *
 * Layout:
 *   Top 5/6: SideTabs (Inv / Char / Spells / Grp)
 *   Bottom 1/6: VitalsPanel (HP / MP / XP bars + Gold + Level)
 *
 * Handles drag-to-drop: items dragged from inventory and dropped onto
 * this sidebar are cancelled; the canvas area handles the actual drop
 * via a separate onDrop handler in Index.tsx.
 */
const GameSidebar = () => {
  const handleDragOver = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Dropping on the sidebar = cancelled. Only canvas drops trigger drop.
  };

  return (
    <div
      className="w-80 h-full bg-slate-900 border-l-[3px] border-slate-500
                 flex flex-col select-none font-mono"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Upper section: Tabs (5/6 of height) ─────────────────────── */}
      <div className="flex-[5] min-h-0 overflow-hidden">
        <SideTabs />
      </div>

      {/* ── Bottom section: Vitals (1/6 of height) ──────────────────── */}
      <div className="flex-[1] min-h-0 flex flex-col justify-end">
        <VitalsPanel />
      </div>
    </div>
  );
};

export default GameSidebar;
