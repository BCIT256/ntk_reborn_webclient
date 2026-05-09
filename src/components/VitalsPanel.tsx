import { useGameState } from "@/hooks/useGameState";

/**
 * VitalsPanel — Classic MMO vitals display fixed to the bottom of the sidebar.
 *
 * Renders HP (red), MP (blue), XP (gold) horizontal progress bars,
 * plus Level and Gold display. Retro NexusTK aesthetic.
 */
const VitalsPanel = () => {
  const { vitals } = useGameState();

  const hpPct = vitals.max_hp > 0 ? Math.min((vitals.hp / vitals.max_hp) * 100, 100) : 0;
  const mpPct = vitals.max_mp > 0 ? Math.min((vitals.mp / vitals.max_mp) * 100, 100) : 0;
  const xpPct = vitals.xp_next > 0 ? Math.min((vitals.xp / vitals.xp_next) * 100, 100) : 0;

  return (
    <div
      className="border-t-2 border-slate-500 bg-slate-900/95 p-3 select-none"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Level + Gold row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-amber-400 font-bold text-xs tracking-wider">
          LV {vitals.level}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-amber-500 text-xs">●</span>
          <span className="text-amber-300 font-semibold text-xs">
            {vitals.gold.toLocaleString()}
          </span>
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-amber-400 text-[10px] font-bold tracking-wider">HP</span>
          <span className="text-slate-300 text-[10px]">
            {vitals.hp} / {vitals.max_hp}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 border border-slate-600 overflow-hidden">
          <div
            className="h-full bg-gradient-to-b from-red-500 to-red-700 transition-all duration-300"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* MP Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-amber-400 text-[10px] font-bold tracking-wider">MP</span>
          <span className="text-slate-300 text-[10px]">
            {vitals.mp} / {vitals.max_mp}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 border border-slate-600 overflow-hidden">
          <div
            className="h-full bg-gradient-to-b from-blue-500 to-blue-700 transition-all duration-300"
            style={{ width: `${mpPct}%` }}
          />
        </div>
      </div>

      {/* XP Bar */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-amber-400 text-[10px] font-bold tracking-wider">XP</span>
          <span className="text-slate-300 text-[10px]">
            {vitals.xp} / {vitals.xp_next}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 border border-slate-600 overflow-hidden">
          <div
            className="h-full bg-gradient-to-b from-amber-500 to-amber-700 transition-all duration-300"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default VitalsPanel;
