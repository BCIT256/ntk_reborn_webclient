import { useCallback } from "react";
import { useGameState } from "@/hooks/useGameState";
import { socket } from "@/socket";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Spellbook — Scrollable list of available spells.
 *
 * Double-clicking a spell fires a CastSpell packet back to the server.
 */
const Spellbook = () => {
  const { spells } = useGameState();

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, spellId: number) => {
      e.stopPropagation();
      socket.send({
        type: "CastSpell",
        payload: { spell_id: spellId },
      });
    },
    []
  );

  return (
    <div
      className="select-none"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {spells.length === 0 ? (
        <div className="p-3 text-slate-500 text-xs text-center">
          No spells learned.
        </div>
      ) : (
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-1 p-2">
            {spells.map((spell) => (
              <div
                key={spell.spell_id}
                onDoubleClick={(e) => handleDoubleClick(e, spell.spell_id)}
                className="border border-slate-700 bg-slate-900 px-3 py-2
                           hover:bg-slate-700 hover:border-slate-500
                           cursor-pointer transition-colors"
                title="Double-click to cast"
              >
                <span className="text-slate-200 text-xs font-medium">
                  {spell.name}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default Spellbook;
