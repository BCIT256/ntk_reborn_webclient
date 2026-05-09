import { useGameState } from "@/hooks/useGameState";

/**
 * CharacterSheet — Displays player stats in the classic NexusTK style.
 *
 * Shows Armor Class, Hit, Damage Modifier, and base stats
 * (Str, Dex, Int, Wis) as a clean text list.
 */
const CharacterSheet = () => {
  const { vitals } = useGameState();

  const stats = [
    { label: "Armor Class", value: vitals.armor_class },
    { label: "Hit", value: vitals.hit },
    { label: "Damage", value: vitals.damage_modifier },
    { label: "Str", value: vitals.str },
    { label: "Dex", value: vitals.dex },
    { label: "Int", value: vitals.int },
    { label: "Wis", value: vitals.wis },
  ];

  return (
    <div
      className="p-3 select-none"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between border border-slate-700 bg-slate-900 px-3 py-1.5"
          >
            <span className="text-amber-400 text-xs font-bold tracking-wider">
              {stat.label}
            </span>
            <span className="text-white text-xs font-semibold">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharacterSheet;
