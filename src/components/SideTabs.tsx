import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import InventoryGrid from "./InventoryGrid";
import CharacterSheet from "./CharacterSheet";
import Spellbook from "./Spellbook";

/**
 * SideTabs — Tabbed interface occupying the upper portion of the sidebar.
 *
 * Tabs: Inv, Char, Spells, Grp — styled in retro NexusTK fashion.
 * Active tab looks "pressed" with gold text on darker background.
 */
const SideTabs = () => {
  return (
    <div
      className="flex-1 flex flex-col select-none overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      <Tabs defaultValue="inv" className="flex-1 flex flex-col">
        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <TabsList className="
          flex h-auto w-full bg-slate-900 border-b-2 border-slate-500
          rounded-none p-0 gap-0
        ">
          <TabsTrigger
            value="inv"
            className="
              flex-1 rounded-none px-2 py-2 text-xs font-bold tracking-wider
              text-slate-400
              border border-b-0 border-transparent
              data-[state=active]:bg-slate-700
              data-[state=active]:text-amber-400
              data-[state=active]:border-slate-400
              data-[state=active]:border-b-slate-700
              hover:text-slate-200
              transition-colors
            "
          >
            Inv
          </TabsTrigger>
          <TabsTrigger
            value="char"
            className="
              flex-1 rounded-none px-2 py-2 text-xs font-bold tracking-wider
              text-slate-400
              border border-b-0 border-transparent
              data-[state=active]:bg-slate-700
              data-[state=active]:text-amber-400
              data-[state=active]:border-slate-400
              data-[state=active]:border-b-slate-700
              hover:text-slate-200
              transition-colors
            "
          >
            Char
          </TabsTrigger>
          <TabsTrigger
            value="spells"
            className="
              flex-1 rounded-none px-2 py-2 text-xs font-bold tracking-wider
              text-slate-400
              border border-b-0 border-transparent
              data-[state=active]:bg-slate-700
              data-[state=active]:text-amber-400
              data-[state=active]:border-slate-400
              data-[state=active]:border-b-slate-700
              hover:text-slate-200
              transition-colors
            "
          >
            Spells
          </TabsTrigger>
          <TabsTrigger
            value="grp"
            className="
              flex-1 rounded-none px-2 py-2 text-xs font-bold tracking-wider
              text-slate-400
              border border-b-0 border-transparent
              data-[state=active]:bg-slate-700
              data-[state=active]:text-amber-400
              data-[state=active]:border-slate-400
              data-[state=active]:border-b-slate-700
              hover:text-slate-200
              transition-colors
            "
          >
            Grp
          </TabsTrigger>
        </TabsList>

        {/* ── Tab content ──────────────────────────────────────────── */}
        <TabsContent
          value="inv"
          className="flex-1 overflow-auto mt-0 border-0 p-0 data-[state=inactive]:hidden"
        >
          <InventoryGrid />
        </TabsContent>

        <TabsContent
          value="char"
          className="flex-1 overflow-auto mt-0 border-0 p-0 data-[state=inactive]:hidden"
        >
          <CharacterSheet />
        </TabsContent>

        <TabsContent
          value="spells"
          className="flex-1 overflow-auto mt-0 border-0 p-0 data-[state=inactive]:hidden"
        >
          <Spellbook />
        </TabsContent>

        <TabsContent
          value="grp"
          className="flex-1 overflow-auto mt-0 border-0 p-0 data-[state=inactive]:hidden"
        >
          <div className="p-3 text-slate-500 text-xs text-center">
            No party members.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SideTabs;
